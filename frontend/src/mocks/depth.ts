import { QTY_LOT_SIZE } from '@/config/hose'
import type { BookLevel, OrderBookDepth, Side, SymbolQuote } from '@/types'
import { getTickSize, isValidTick, stepPrice } from '@/utils/hose'

/** Số mức giá của sổ lệnh tất định (engine dùng khi quote không có depth). */
export const BOOK_LEVELS = 5
/** KL của mức thứ i (tính từ 0) trong sổ lệnh tất định. */
const LEVEL_QTY = [2_000, 3_000, 4_000, 5_000, 6_000]

/** Số mức mỗi phía của sổ lệnh thị trường mà bộ giả lập sinh và màn hình hiển thị. */
export const DEPTH_LEVELS = 3
/** KL một mức mới sinh: 1.000 – 9.900 cổ phiếu. */
const NEW_LEVEL_MIN_LOTS = 10
const NEW_LEVEL_SPREAD_LOTS = 90
/** Thị trường bổ sung KL dần: mỗi nhịp, mỗi mức có xác suất này được thêm 1–5 lô. */
const REPLENISH_PROBABILITY = 0.3
const REPLENISH_MAX_LOTS = 5
/** Một mức không tự phình quá KL này. */
const LEVEL_QTY_CAP = 20_000
/** Số nhịp giữ dấu "KL vừa bị lệnh của mình lấy" trước khi xóa. */
export const OWN_TAKEN_TICKS = 3

type RandomFn = () => number
/** Phía của sổ lệnh: bids là các mức mua, asks là các mức bán. */
export type BookSide = 'bids' | 'asks'

/**
 * Các mức giá phía đối ứng mà một lệnh `side` có thể quét: lệnh MUA quét phía bán (asks), lệnh BÁN quét phía mua (bids).
 * Lấy từ `quote.depth` nếu có; không có thì dựng tất định từ ask, bid theo bước giá, để kết quả lặp lại được.
 */
export function getBookLevels(quote: SymbolQuote, side: Side, count = BOOK_LEVELS): BookLevel[] {
  const provided = side === 'BUY' ? quote.depth?.asks : quote.depth?.bids
  if (provided) return provided.slice(0, count)

  const levels: BookLevel[] = []
  let price = side === 'BUY' ? quote.ask_price : quote.bid_price
  for (let index = 0; index < count; index += 1) {
    if (price < quote.floor_price || price > quote.ceiling_price) break
    levels.push({ price, qty: LEVEL_QTY[index] ?? LEVEL_QTY[LEVEL_QTY.length - 1] })
    // Bước xuống dùng bước giá của mức phía dưới, như bộ giả lập.
    price = side === 'BUY' ? price + getTickSize(price) : price - getTickSize(price - 1)
  }
  return levels
}

/** Mức giá được phép quét: MUA không vượt giá tối đa, BÁN không thấp hơn giá tối thiểu. */
export function isWithinLimit(side: Side, price: number, limit: number | null) {
  if (limit === null) return true
  return side === 'BUY' ? price <= limit : price >= limit
}

/** Phía sổ lệnh mà lệnh `side` lấy thanh khoản: MUA lấy phía bán, BÁN lấy phía mua. */
export function oppositeBookSide(side: Side): BookSide {
  return side === 'BUY' ? 'asks' : 'bids'
}

function randomLevelQty(random: RandomFn) {
  return (NEW_LEVEL_MIN_LOTS + Math.floor(random() * NEW_LEVEL_SPREAD_LOTS)) * QTY_LOT_SIZE
}

function isInBand(price: number, quote: Pick<SymbolQuote, 'floor_price' | 'ceiling_price'>) {
  return price >= quote.floor_price && price <= quote.ceiling_price
}

/** Giá kế tiếp phía sau mức `price`: phía bán đi lên, phía mua đi xuống, đúng bước giá. */
function nextPriceAfter(side: BookSide, price: number) {
  return stepPrice(price, side === 'asks' ? 1 : -1)
}

/** Thêm mức mới phía sau cho tới đủ `count` mức hoặc chạm trần (phía bán), sàn (phía mua). */
function extendSide(levels: BookLevel[], side: BookSide, start: number, quote: SymbolQuote, random: RandomFn, count: number) {
  const result = [...levels]
  let price = result.length > 0 ? nextPriceAfter(side, result[result.length - 1].price) : start
  while (result.length < count && isInBand(price, quote)) {
    result.push({ price, qty: randomLevelQty(random) })
    price = nextPriceAfter(side, price)
  }
  return result
}

/**
 * Sinh sổ lệnh `levels` mức mỗi phía: mua từ giá mua tốt nhất đi xuống, bán từ giá bán tốt nhất đi lên,
 * mỗi mức cách nhau đúng 1 bước giá theo vùng giá, nằm trong trần – sàn, KL bội số 100.
 */
export function generateDepth(quote: SymbolQuote, random: RandomFn, levels = DEPTH_LEVELS): OrderBookDepth {
  return {
    bids: extendSide([], 'bids', quote.bid_price, quote, random, levels),
    asks: extendSide([], 'asks', quote.ask_price, quote, random, levels),
  }
}

/**
 * Lệnh của mình lấy `qty` ở mức `price` của phía `side`. Lấy tối đa KL đang có ở mức đó.
 * Mức hết KL thì bỏ, các mức sau dồn lên và sinh mức mới phía sau để vẫn đủ số mức.
 * Mức còn KL ghi `own_taken` (cộng dồn) để màn hình hiện phần vừa bị lấy.
 */
export function consumeLevel(
  depth: OrderBookDepth,
  side: BookSide,
  price: number,
  qty: number,
  quote: SymbolQuote,
  random: RandomFn,
  levels = DEPTH_LEVELS,
): { depth: OrderBookDepth; taken: number } {
  const current = depth[side]
  const index = current.findIndex((level) => level.price === price)
  if (index < 0 || qty <= 0) return { depth, taken: 0 }
  const level = current[index]
  const taken = Math.min(qty, level.qty)
  const remaining = level.qty - taken
  let next: BookLevel[]
  if (remaining > 0) {
    next = current.map((item, position) =>
      position === index ? { price: item.price, qty: remaining, own_taken: (item.own_taken ?? 0) + taken, own_taken_age: 0 } : item,
    )
  } else {
    const start = side === 'asks' ? quote.ask_price : quote.bid_price
    next = extendSide(
      current.filter((_, position) => position !== index),
      side,
      start,
      quote,
      random,
      Math.max(levels, current.length - 1),
    )
  }
  return { depth: { ...depth, [side]: next }, taken }
}

/** Thị trường tự bổ sung KL dần theo thời gian, và xóa dấu `own_taken` đã giữ đủ số nhịp. */
export function replenishDepth(depth: OrderBookDepth, random: RandomFn): OrderBookDepth {
  const refill = (level: BookLevel): BookLevel => {
    let qty = level.qty
    if (random() < REPLENISH_PROBABILITY) {
      qty = Math.min(LEVEL_QTY_CAP, qty + (1 + Math.floor(random() * REPLENISH_MAX_LOTS)) * QTY_LOT_SIZE)
    }
    const age = (level.own_taken_age ?? 0) + 1
    if (level.own_taken === undefined || age >= OWN_TAKEN_TICKS) return { price: level.price, qty }
    return { ...level, qty, own_taken_age: age }
  }
  return { bids: depth.bids.map(refill), asks: depth.asks.map(refill) }
}

/**
 * Neo sổ lệnh theo giá mua, bán tốt nhất của quote sau khi giá đổi.
 * Giữ KL của các mức giá còn hợp lệ, bỏ mức đã bị vượt qua, thêm mức tốt nhất nếu chưa có, rồi bổ sung đủ số mức.
 */
export function rebaseDepth(depth: OrderBookDepth, quote: SymbolQuote, random: RandomFn, levels = DEPTH_LEVELS): OrderBookDepth {
  const rebaseSide = (side: BookSide): BookLevel[] => {
    const best = side === 'asks' ? quote.ask_price : quote.bid_price
    const kept = depth[side].filter((level) =>
      isInBand(level.price, quote) && (side === 'asks' ? level.price >= best : level.price <= best),
    )
    const withBest = kept[0]?.price === best || !isInBand(best, quote) ? kept : [{ price: best, qty: randomLevelQty(random) }, ...kept]
    return extendSide(withBest, side, best, quote, random, levels)
  }
  const asks = rebaseSide('asks')
  // Giá bán tốt nhất luôn cao hơn giá mua tốt nhất.
  const bids = rebaseSide('bids').filter((level) => asks.length === 0 || level.price < asks[0].price)
  return { bids, asks }
}

/** Kiểm sổ lệnh theo luật HOSE. Trả về danh sách lỗi, rỗng là hợp lệ. Dùng cho test và kiểm tra lúc chạy. */
export function validateDepth(depth: OrderBookDepth, quote: Pick<SymbolQuote, 'floor_price' | 'ceiling_price'>): string[] {
  const errors: string[] = []
  const check = (side: BookSide) => {
    depth[side].forEach((level, index) => {
      if (!isValidTick(level.price)) errors.push(`${side}[${index}] sai bước giá: ${level.price}`)
      if (!isInBand(level.price, quote)) errors.push(`${side}[${index}] ngoài trần – sàn: ${level.price}`)
      if (level.qty <= 0 || level.qty % QTY_LOT_SIZE !== 0) errors.push(`${side}[${index}] KL không phải bội 100: ${level.qty}`)
      const previous = depth[side][index - 1]
      if (previous) {
        const ordered = side === 'asks' ? level.price >= stepPrice(previous.price, 1) : level.price <= stepPrice(previous.price, -1)
        if (!ordered) errors.push(`${side}[${index}] không cách mức trước ít nhất 1 bước giá`)
      }
    })
  }
  check('bids')
  check('asks')
  if (depth.bids[0] && depth.asks[0] && depth.asks[0].price <= depth.bids[0].price) {
    errors.push('Giá bán 1 phải cao hơn giá mua 1')
  }
  return errors
}

/** Bộ sinh số giả ngẫu nhiên có seed (LCG) dành riêng cho sổ lệnh, không dùng chung dãy random của giá. */
export function createDepthRandom(seed: number): RandomFn {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 2 ** 32
  }
}
