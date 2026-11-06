import { QTY_LOT_SIZE } from '@/config/hose'
import { toDateString } from '@/lib/format'
import type { MarketState, SimSpeed, SymbolQuote } from '@/types'
import { getCeilingPrice, getFloorPrice, getSessionAt, getTickSize } from '@/utils/hose'
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

interface SimulatorOptions {
  /** Truyền hàm random cố định khi test để kết quả lặp lại được. */
  random?: RandomFn
  symbols?: ReadonlyArray<{ symbol: string; ref_price: number }>
  /** Ngày giao dịch đầu tiên. Không truyền thì lấy ngày hiện tại. */
  startDate?: Date
}

/** Phần trạng thái cần lưu lại để tải lại trang không mất. */
export type SimulatorState = Pick<MarketState, 'trading_date' | 'sim_seconds' | 'speed' | 'quotes'>

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
    last_qty: 0,
    total_volume: 0,
    bid_price: clamp(stepPrice(refPrice, -1), floor, ceiling),
    ask_price: clamp(stepPrice(refPrice, 1), floor, ceiling),
    tick_direction: 0,
  }
}

function nextQuote(quote: SymbolQuote, random: RandomFn): SymbolQuote {
  if (random() > TRADE_PROBABILITY) return { ...quote, tick_direction: 0 }

  // Số bước trong khoảng -2..2, bỏ giá trị 0.
  const magnitude = random() < 0.75 ? 1 : 2
  const steps = random() < 0.5 ? -magnitude : magnitude
  const lastPrice = clamp(
    stepPrice(quote.last_price, steps),
    quote.floor_price,
    quote.ceiling_price,
  )
  const lastQty = (1 + Math.floor(random() * 50)) * QTY_LOT_SIZE

  return {
    ...quote,
    last_price: lastPrice,
    last_qty: lastQty,
    total_volume: quote.total_volume + lastQty,
    bid_price: clamp(stepPrice(lastPrice, -1), quote.floor_price, quote.ceiling_price),
    ask_price: clamp(stepPrice(lastPrice, 1), quote.floor_price, quote.ceiling_price),
    tick_direction: Math.sign(lastPrice - quote.last_price) as SymbolQuote['tick_direction'],
  }
}

export function createMarketSimulator(options: SimulatorOptions = {}) {
  const random = options.random ?? Math.random
  const symbols = options.symbols ?? DEMO_SYMBOLS
  const listeners = new Set<Listener>()

  const getStartDate = () => toDateString(options.startDate ?? new Date())
  let tradingDate = getStartDate()
  let simSeconds = START_SECONDS
  let speed: SimSpeed = 1
  let quotes = symbols.map((item) => createInitialQuote(item.symbol, item.ref_price))
  let timer: ReturnType<typeof setInterval> | null = null

  function getState(): MarketState {
    return {
      trading_date: tradingDate,
      sim_seconds: simSeconds,
      session: getSessionAt(simSeconds),
      speed,
      quotes,
    }
  }

  function notify() {
    const state = getState()
    listeners.forEach((listener) => listener(state))
  }

  /** Một nhịp giả lập: tua đồng hồ theo tốc độ, rồi cho giá nhảy nếu thị trường đang mở. */
  function tick(elapsedMs = TICK_INTERVAL_MS) {
    simSeconds = Math.min(simSeconds + (elapsedMs / 1000) * speed, END_SECONDS)
    const session = getSessionAt(simSeconds)
    const isMarketOpen = session === 'ATO' || session === 'CONTINUOUS' || session === 'ATC'
    quotes = quotes.map((quote) =>
      isMarketOpen ? nextQuote(quote, random) : { ...quote, tick_direction: 0 },
    )
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
    /** Về đầu ngày: ngày về hiện tại, đồng hồ về 09:10, giá về tham chiếu, giữ nguyên tốc độ. */
    reset() {
      tradingDate = getStartDate()
      simSeconds = START_SECONDS
      quotes = symbols.map((item) => createInitialQuote(item.symbol, item.ref_price))
      notify()
    },
    /** Sang ngày giao dịch mới: giá đóng cửa hôm trước thành giá tham chiếu hôm nay. */
    nextDay() {
      tradingDate = getNextTradingDate(tradingDate)
      simSeconds = START_SECONDS
      quotes = quotes.map((quote) => createInitialQuote(quote.symbol, quote.last_price))
      notify()
    },
    exportState(): SimulatorState {
      return { trading_date: tradingDate, sim_seconds: simSeconds, speed, quotes }
    },
    importState(state: SimulatorState) {
      tradingDate = state.trading_date
      simSeconds = state.sim_seconds
      speed = state.speed
      quotes = state.quotes
    },
  }
}

export const marketSimulator = createMarketSimulator()
