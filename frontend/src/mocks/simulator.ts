import { QTY_LOT_SIZE, TRADING_SESSIONS } from '@/config/hose'
import { formatClock, toDateString } from '@/lib/format'
import type { MarketState, MarketTrade, OrderBookDepth, SimSpeed, SymbolQuote } from '@/types'
import {
  getCeilingPrice,
  getDisplayPrice,
  getFloorPrice,
  getSessionAt,
  getTickSize,
  isAuctionSession,
} from '@/utils/hose'
import { DEMO_SYMBOLS } from './data'

const hhmm = (hour: number, minute: number) => hour * 3600 + minute * 60

/** Mở app ở 09:10 (đang ATO) để demo được lúc chuyển sang phiên liên tục. */
const START_SECONDS = hhmm(9, 10)
/** Đồng hồ dừng ở 15:00, sau khi đóng cửa 14:45. */
const END_SECONDS = hhmm(15, 0)
const TICK_INTERVAL_MS = 1000
/** Xác suất một mã có giao dịch trong mỗi nhịp. */
const TRADE_PROBABILITY = 0.4

type RandomFn = () => number
type Listener = (state: MarketState) => void
type TradeListener = (trades: MarketTrade[]) => void

interface SimulatorOptions {
  /** Truyền hàm random cố định khi test để kết quả lặp lại được. */
  random?: RandomFn
  symbols?: ReadonlyArray<{ symbol: string; ref_price: number }>
  /** Ngày giao dịch đầu tiên. Không truyền thì lấy ngày hiện tại. */
  startDate?: Date
}

/** Phần trạng thái cần lưu lại để tải lại trang không mất. */
export type SimulatorState = Pick<MarketState, 'trading_date' | 'sim_seconds' | 'speed' | 'quotes'> & {
  quote_age_ms: number
  feed_stale: boolean
}

/** Ngày làm việc kế tiếp, bỏ qua thứ Bảy và Chủ nhật. */
function getNextTradingDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  const next = new Date(year, month - 1, day + 1)
  while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1)
  return toDateString(next)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

/**
 * Đi từng bước một thay vì nhân (tick x số bước), vì bước giá đổi khi qua ngưỡng 10.000 và 50.000.
 * Ví dụ 49.950 + 100 = 50.050 sai bước, còn 49.950 → 50.000 → 50.100 thì đúng.
 */
function stepPrice(price: number, steps: number): number {
  let result = price
  for (let index = 0; index < Math.abs(steps); index += 1) {
    if (steps > 0) {
      result += getTickSize(result)
    } else {
      // Bước xuống dùng bước giá của mức giá phía dưới: 50.000 xuống 49.950, không phải 49.900.
      result -= getTickSize(result - 1)
    }
  }
  return result
}

function createInitialQuote(symbol: string, refPrice: number): SymbolQuote {
  const ceiling = getCeilingPrice(refPrice)
  const floor = getFloorPrice(refPrice)
  return {
    symbol,
    ref_price: refPrice,
    ceiling_price: ceiling,
    floor_price: floor,
    last_price: refPrice,
    indicative_price: null,
    last_qty: 0,
    total_volume: 0,
    bid_price: clamp(stepPrice(refPrice, -1), floor, ceiling),
    ask_price: clamp(stepPrice(refPrice, 1), floor, ceiling),
    tick_direction: 0,
  }
}

/** Bước giá ngẫu nhiên từ -2 đến 2, bỏ giá trị 0, luôn nằm trong biên độ. */
function randomWalk(price: number, quote: SymbolQuote, random: RandomFn): number {
  const magnitude = random() < 0.75 ? 1 : 2
  const steps = random() < 0.5 ? -magnitude : magnitude
  return clamp(stepPrice(price, steps), quote.floor_price, quote.ceiling_price)
}

/** Ghi nhận một lần khớp: cập nhật giá khớp, KL, giá mua bán. */
function withMatch(quote: SymbolQuote, price: number, qty: number): SymbolQuote {
  return {
    ...quote,
    last_price: price,
    indicative_price: null,
    last_qty: qty,
    total_volume: quote.total_volume + qty,
    bid_price: clamp(stepPrice(price, -1), quote.floor_price, quote.ceiling_price),
    ask_price: clamp(stepPrice(price, 1), quote.floor_price, quote.ceiling_price),
    tick_direction: Math.sign(price - quote.last_price) as SymbolQuote['tick_direction'],
  }
}

function nextQuote(quote: SymbolQuote, random: RandomFn): SymbolQuote {
  if (random() > TRADE_PROBABILITY) return { ...quote, tick_direction: 0 }
  const price = randomWalk(quote.last_price, quote, random)
  return withMatch(quote, price, (1 + Math.floor(random() * 50)) * QTY_LOT_SIZE)
}

/** Trong ATO, ATC chỉ giá dự kiến thay đổi. Giá khớp và KL đứng yên cho tới lúc khớp định kỳ. */
function nextIndicative(quote: SymbolQuote, random: RandomFn): SymbolQuote {
  const current = getDisplayPrice(quote)
  if (random() > TRADE_PROBABILITY) return { ...quote, indicative_price: current, tick_direction: 0 }
  const price = randomWalk(current, quote, random)
  return {
    ...quote,
    indicative_price: price,
    tick_direction: Math.sign(price - current) as SymbolQuote['tick_direction'],
  }
}

/** Hết phiên ATO, ATC: khớp một lần duy nhất theo giá dự kiến. KL định kỳ lớn hơn một nhịp thường. */
function matchAuction(quote: SymbolQuote, random: RandomFn): SymbolQuote {
  const qty = (50 + Math.floor(random() * 200)) * QTY_LOT_SIZE
  return withMatch(quote, getDisplayPrice(quote), qty)
}

export function createMarketSimulator(options: SimulatorOptions = {}) {
  const random = options.random ?? Math.random
  const symbols = options.symbols ?? DEMO_SYMBOLS
  const listeners = new Set<Listener>()
  const tradeListeners = new Set<TradeListener>()

  const getStartDate = () => toDateString(options.startDate ?? new Date())
  let tradingDate = getStartDate()
  let simSeconds = START_SECONDS
  let speed: SimSpeed = 1
  let quotes = symbols.map((item) => createInitialQuote(item.symbol, item.ref_price))
  let timer: ReturnType<typeof setInterval> | null = null
  /** Thời gian thật (mili giây) kể từ lần cuối nhận được giá. Cố ý không nhân với tốc độ tua. */
  let quoteAgeMs = 0
  /** Đang bơm lỗi giá trễ: đồng hồ vẫn chạy nhưng không có giá mới. */
  let feedStale = false
  /** Chế độ có kịch bản (Demo). */
  let scripted = false

  function getState(): MarketState {
    return {
      trading_date: tradingDate,
      sim_seconds: simSeconds,
      quote_age_seconds: Math.floor(quoteAgeMs / 1000),
      session: getSessionAt(simSeconds),
      speed,
      quotes,
    }
  }

  function notify() {
    const state = getState()
    listeners.forEach((listener) => listener(state))
  }

  /** Mã nào có KL khớp tăng trong nhịp này thì phát một tick khớp: giá khớp mới, KL phần tăng thêm. */
  function emitTrades(before: SymbolQuote[]) {
    if (tradeListeners.size === 0) return
    const time = `${tradingDate}T${formatClock(simSeconds)}`
    const trades: MarketTrade[] = []
    quotes.forEach((quote, index) => {
      const qty = quote.total_volume - (before[index]?.total_volume ?? 0)
      if (qty > 0) trades.push({ symbol: quote.symbol, time, price: quote.last_price, qty })
    })
    if (trades.length > 0) tradeListeners.forEach((listener) => listener(trades))
  }

  /** Một nhịp giả lập: tua đồng hồ theo tốc độ, rồi cho giá nhảy nếu thị trường đang mở. */
  function tick(elapsedMs = TICK_INTERVAL_MS) {
    // Chế độ có kịch bản (Demo): đồng hồ và giá chỉ đổi theo lệnh của kịch bản.
    if (scripted) return
    const previous = getSessionAt(simSeconds)
    let next = Math.min(simSeconds + (elapsedMs / 1000) * speed, END_SECONDS)
    if (isAuctionSession(previous)) {
      // Không tua vượt giờ khớp định kỳ, để luôn khớp đúng 09:15:00 và 14:45:00 ở mọi tốc độ.
      const auctionEnd = TRADING_SESSIONS.find((item) => item.code === previous)?.end
      if (auctionEnd !== undefined) next = Math.min(next, auctionEnd)
    }
    simSeconds = next

    if (feedStale) {
      quoteAgeMs += elapsedMs
      quotes = quotes.map((quote) => ({ ...quote, tick_direction: 0 }))
      notify()
      return
    }

    quoteAgeMs = 0
    const session = getSessionAt(simSeconds)
    const before = quotes
    quotes = quotes.map((quote) => {
      if (isAuctionSession(previous) && session !== previous) return matchAuction(quote, random)
      if (isAuctionSession(session)) return nextIndicative(quote, random)
      if (session === 'CONTINUOUS') return nextQuote(quote, random)
      return { ...quote, tick_direction: 0 }
    })
    emitTrades(before)
    notify()
  }

  return {
    getState,
    tick,
    /** Đăng ký nhận dữ liệu. Nhận ngay trạng thái hiện tại, trả về hàm hủy đăng ký. */
    subscribe(listener: Listener) {
      listeners.add(listener)
      listener(getState())
      return () => {
        listeners.delete(listener)
      }
    },
    // ===== Điều khiển có kịch bản (Chế độ Demo) =====
    /** Bật thì nhịp hẹn giờ không làm gì: giá không tự đi, đồng hồ đứng, chỉ đổi qua các hàm bên dưới. */
    setScripted(on: boolean) {
      scripted = on
    },
    isScripted: () => scripted,
    /** Một lần khớp trên thị trường của mã: cập nhật giá khớp, KL, giá mua bán, phát tick khớp. */
    pushTrade(symbol: string, price: number, qty: number) {
      const before = quotes
      quotes = quotes.map((quote) => (quote.symbol === symbol ? withMatch(quote, price, qty) : quote))
      emitTrades(before)
      notify()
    },
    /** Đặt sổ lệnh nhiều mức cho mã. Truyền undefined để bỏ, engine dùng sổ lệnh tất định. */
    setDepth(symbol: string, depth: OrderBookDepth | undefined) {
      quotes = quotes.map((quote) => (quote.symbol === symbol ? { ...quote, depth } : quote))
      notify()
    },
    /** Nhảy tới giờ giả lập (giây trong ngày), phát trạng thái để engine chạy một nhịp. */
    jumpTo(seconds: number) {
      simSeconds = Math.min(Math.max(seconds, 0), END_SECONDS)
      notify()
    },
    /** Tua thêm `seconds` giây giả lập, mỗi giây một nhịp. Giá đứng yên; đang bơm giá trễ thì tuổi giá tăng. */
    advance(seconds: number) {
      for (let step = 0; step < seconds && simSeconds < END_SECONDS; step += 1) {
        simSeconds += 1
        quoteAgeMs = feedStale ? quoteAgeMs + TICK_INTERVAL_MS : 0
        quotes = quotes.map((quote) => (quote.tick_direction === 0 ? quote : { ...quote, tick_direction: 0 }))
        notify()
      }
    },
    /** Nhận các tick khớp toàn thị trường sau mỗi nhịp. Trả về hàm hủy đăng ký. */
    onTrades(listener: TradeListener) {
      tradeListeners.add(listener)
      return () => {
        tradeListeners.delete(listener)
      }
    },
    start() {
      if (timer === null) timer = setInterval(() => tick(), TICK_INTERVAL_MS)
    },
    stop() {
      if (timer !== null) clearInterval(timer)
      timer = null
    },
    setSpeed(next: SimSpeed) {
      speed = next
      notify()
    },
    /** Bật, tắt lỗi giá trễ. Tắt rồi thì nhịp kế tiếp mới có giá mới. */
    setFeedStale(stale: boolean) {
      feedStale = stale
    },
    isFeedStale: () => feedStale,
    /** Về đầu ngày: ngày về hiện tại, đồng hồ về 09:10, giá về tham chiếu, giữ nguyên tốc độ. */
    reset() {
      tradingDate = getStartDate()
      simSeconds = START_SECONDS
      quoteAgeMs = 0
      feedStale = false
      quotes = symbols.map((item) => createInitialQuote(item.symbol, item.ref_price))
      notify()
    },
    /** Sang ngày giao dịch mới: giá đóng cửa hôm trước thành giá tham chiếu hôm nay. */
    nextDay() {
      tradingDate = getNextTradingDate(tradingDate)
      simSeconds = START_SECONDS
      quoteAgeMs = 0
      quotes = quotes.map((quote) => createInitialQuote(quote.symbol, quote.last_price))
      notify()
    },
    exportState(): SimulatorState {
      return {
        trading_date: tradingDate,
        sim_seconds: simSeconds,
        speed,
        quotes,
        quote_age_ms: quoteAgeMs,
        feed_stale: feedStale,
      }
    },
    importState(state: SimulatorState) {
      tradingDate = state.trading_date
      simSeconds = state.sim_seconds
      quoteAgeMs = state.quote_age_ms
      feedStale = state.feed_stale
      speed = state.speed
      quotes = state.quotes
    },
  }
}

export const marketSimulator = createMarketSimulator()
