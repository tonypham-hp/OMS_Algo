import type { BookLevel, Side, SymbolQuote } from '@/types'
import { getTickSize } from '@/utils/hose'

/** Số mức giá của sổ lệnh tất định. */
export const BOOK_LEVELS = 5
/** KL của mức thứ i (tính từ 0) trong sổ lệnh tất định. */
const LEVEL_QTY = [2_000, 3_000, 4_000, 5_000, 6_000]

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
