import { QTY_LOT_SIZE } from '@/config/hose'
import { formatClock, toDateString } from '@/lib/format'
import { isTradingDay, nextTradingDate } from '@/rules/calendar'
import { getTickSize, priceLimits, stepPrice } from '@/rules/price'
import { resolveRules, rulesFor } from '@/rules/registry'
import { getSessionAt, isAuctionSession, parseTimeToSeconds, restrictedPhaseAt, sessionEndAt } from '@/rules/session'
import { getListing, symbolBoardStatus } from '@/rules/symbols'
import type { Board, RulePack, SecType } from '@/rules/types'
import type { MarketState, MarketTrade, OrderBookDepth, SessionCode, SimSpeed, SymbolPhase, SymbolQuote } from '@/types'
import { getDisplayPrice } from '@/utils/hose'
import { ALL_SYMBOLS, EXTRA_SYMBOLS, FOREIGN_ROOM, RESTRICTED_SYMBOLS, SPECIAL_SYMBOLS } from './data'
import { type BookSide, consumeLevel, createDepthRandom, generateDepth, rebaseDepth, replenishDepth } from './depth'

/** Mở app ở 09:10 (đang ATO) để demo được lúc chuyển sang phiên liên tục. */
const START_SECONDS = parseTimeToSeconds('09:10') as number
/** Đồng hồ dừng ở 15:00, hết phiên thỏa thuận sau giờ của HOSE. */
const END_SECONDS = parseTimeToSeconds('15:00') as number
const TICK_INTERVAL_MS = 1000
/** Xác suất một mã có giao dịch trong mỗi nhịp. */
const TRADE_PROBABILITY = 0.4
const BOARDS: readonly Board[] = ['STO', 'STX', 'UPX']

type RandomFn = () => number
type Listener = (state: MarketState) => void
type TradeListener = (trades: MarketTrade[]) => void

interface SimulatorOptions {
  /** Truyền hàm random cố định khi test để kết quả lặp lại được. */
  random?: RandomFn
  /** Seed của dãy random riêng cho sổ lệnh, tách khỏi dãy random của giá để không làm lệch kết quả cũ. */
  depthSeed?: number
  symbols?: ReadonlyArray<{ symbol: string; ref_price: number }>
  /** Ngày giao dịch đầu tiên. Không truyền thì lấy ngày hiện tại. */
  startDate?: Date
}

/** Phần trạng thái cần lưu lại để tải lại trang không mất. */
export type SimulatorState = Pick<MarketState, 'trading_date' | 'sim_seconds' | 'speed' | 'quotes'> & {
  quote_age_ms: number
  feed_stale: boolean
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

/** Luật của một dòng bảng giá. Mã ngừng giao dịch vẫn hiện trần/sàn theo bảng HOSE. */
function contextOf(quote: Pick<SymbolQuote, 'board' | 'sec_type'>, date: string): { rules: RulePack; secType: SecType } {
  return { rules: rulesFor(quote.board ?? 'STO', date), secType: quote.sec_type ?? 'STOCK' }
}

function step(quote: SymbolQuote, price: number, steps: number, date: string) {
  const { rules, secType } = contextOf(quote, date)
  return stepPrice(price, steps, secType, rules)
}

/**
 * Dòng bảng giá đầu ngày: bảng giao dịch theo ngày (mã HNX sang HOSE từ 28/12/2026), trần/sàn theo pack
 * và loại chứng khoán. Chứng quyền tính theo mã cơ sở nên cần `underlying`.
 */
function createInitialQuote(
  symbol: string,
  refPrice: number,
  depthRandom: RandomFn,
  date: string,
  extra: { underlying?: SymbolQuote; foreignRoom?: number } = {},
): SymbolQuote {
  const status = symbolBoardStatus(symbol, date)
  const listing = getListing(symbol)
  const secType = listing?.secType ?? 'STOCK'
  const rules = rulesFor(status.board ?? 'STO', date)
  const cw =
    secType === 'CW' && listing?.cw && extra.underlying
      ? {
          ratio: listing.cw.ratio,
          underlyingRef: extra.underlying.ref_price,
          underlyingCeiling: extra.underlying.ceiling_price,
          underlyingFloor: extra.underlying.floor_price,
        }
      : undefined
  const limits = priceLimits(refPrice, secType, rules, { cw, firstDay: listing?.firstTradingDate === date })
  const tickStep = (price: number, steps: number) => stepPrice(price, steps, secType, rules)
  const foreignRoom = extra.foreignRoom ?? FOREIGN_ROOM[symbol]
  const quote: SymbolQuote = {
    symbol,
    ref_price: refPrice,
    ceiling_price: limits.ceiling,
    floor_price: limits.floor,
    last_price: refPrice,
    indicative_price: null,
    last_qty: 0,
    total_volume: 0,
    bid_price: clamp(tickStep(refPrice, -1), limits.minOrderPrice, limits.ceiling),
    ask_price: clamp(tickStep(refPrice, 1), limits.minOrderPrice, limits.ceiling),
    tick_direction: 0,
    board: status.board,
    sec_type: secType,
    ...(status.transferred ? { transferred: true } : {}),
    ...(RESTRICTED_SYMBOLS.includes(symbol) ? { trading_status: 'RESTRICTED' as const } : {}),
    ...(foreignRoom !== undefined ? { foreign_room: foreignRoom } : {}),
  }
  return status.halted ? quote : { ...quote, depth: generateDepth(quote, depthRandom) }
}

/** Neo lại sổ lệnh theo giá mua, bán tốt nhất mới (hoặc sinh mới nếu chưa có). */
function withDepth(quote: SymbolQuote, depthRandom: RandomFn): SymbolQuote {
  const depth = quote.depth ? rebaseDepth(quote.depth, quote, depthRandom) : generateDepth(quote, depthRandom)
  return { ...quote, depth }
}

/** Giá mua, bán tốt nhất luôn bằng mức đầu của sổ lệnh (khi phía đó còn mức). */
function syncBestFromDepth(quote: SymbolQuote): SymbolQuote {
  if (!quote.depth) return quote
  return {
    ...quote,
    bid_price: quote.depth.bids[0]?.price ?? quote.bid_price,
    ask_price: quote.depth.asks[0]?.price ?? quote.ask_price,
  }
}

export function createMarketSimulator(options: SimulatorOptions = {}) {
  const random = options.random ?? Math.random
  const symbols = options.symbols ?? ALL_SYMBOLS
  const listeners = new Set<Listener>()
  const tradeListeners = new Set<TradeListener>()
  const depthRandom = createDepthRandom(options.depthSeed ?? 20_261_113)
  // Mã thêm ở Đợt 8A sinh giá bằng dãy random riêng, để giá của 10 mã cũ (và mọi kết quả cũ) không đổi.
  const extraSymbols = new Set(options.symbols ? [] : EXTRA_SYMBOLS.map((item) => item.symbol))
  const extraRandom = createDepthRandom(20_261_228)
  const extraDepthRandom = createDepthRandom(20_261_229)
  // Mã thêm ở Đợt 8B: mỗi mã một dãy random riêng (seed theo tên mã).
  const ownRandoms = new Map<string, { price: RandomFn; depth: RandomFn }>()
  const specialSymbols = new Set(options.symbols ? [] : SPECIAL_SYMBOLS.map((item) => item.symbol))
  const ownRandom = (symbol: string) => {
    let entry = ownRandoms.get(symbol)
    if (!entry) {
      const seed = [...symbol].reduce((sum, char) => sum * 31 + char.charCodeAt(0), 7) >>> 0
      entry = { price: createDepthRandom(seed), depth: createDepthRandom(seed + 1) }
      ownRandoms.set(symbol, entry)
    }
    return entry
  }
  const randomOf = (symbol: string) =>
    specialSymbols.has(symbol) ? ownRandom(symbol).price : extraSymbols.has(symbol) ? extraRandom : random
  const depthRandomOf = (symbol: string) =>
    specialSymbols.has(symbol) ? ownRandom(symbol).depth : extraSymbols.has(symbol) ? extraDepthRandom : depthRandom

  const getStartDate = () => toDateString(options.startDate ?? new Date())
  let tradingDate = getStartDate()
  let simSeconds = START_SECONDS
  let speed: SimSpeed = 1
  let quotes: SymbolQuote[] = []
  let timer: ReturnType<typeof setInterval> | null = null
  /** Thời gian thật (mili giây) kể từ lần cuối nhận được giá. Cố ý không nhân với tốc độ tua. */
  let quoteAgeMs = 0
  /** Đang bơm lỗi giá trễ: đồng hồ vẫn chạy nhưng không có giá mới. */
  let feedStale = false
  /** Chế độ có kịch bản (Demo). */
  let scripted = false
  /** Tổng giá trị, KL khớp trong ngày theo mã, để tính giá tham chiếu bình quân gia quyền (UPCoM). */
  let dayStats = new Map<string, { value: number; volume: number }>()

  /** Dựng bảng giá đầu ngày. Chứng quyền dựng sau mã cơ sở. */
  function buildQuotes(entries: ReadonlyArray<{ symbol: string; ref_price: number; foreign_room?: number }>) {
    const built = new Map<string, SymbolQuote>()
    const ordered = [...entries].sort((a, b) => Number(Boolean(getListing(a.symbol)?.cw)) - Number(Boolean(getListing(b.symbol)?.cw)))
    for (const entry of ordered) {
      const underlying = getListing(entry.symbol)?.cw?.underlying
      built.set(
        entry.symbol,
        createInitialQuote(entry.symbol, entry.ref_price, depthRandomOf(entry.symbol), tradingDate, {
          underlying: underlying ? built.get(underlying) : undefined,
          foreignRoom: entry.foreign_room,
        }),
      )
    }
    return entries.map((entry) => built.get(entry.symbol) as SymbolQuote)
  }

  quotes = buildQuotes(symbols)

  const stoRules = () => rulesFor('STO', tradingDate)

  /** Phiên của từng bảng có pack hiệu lực trong ngày. */
  function boardSessions(seconds: number): Partial<Record<Board, SessionCode>> {
    const result: Partial<Record<Board, SessionCode>> = {}
    for (const board of BOARDS) {
      const rules = resolveRules(board, tradingDate)
      if (rules) result[board] = getSessionAt(seconds, rules)
    }
    return result
  }

  /**
   * Phiên riêng của mã khi khác phiên của bảng: mã bị hạn chế giao dịch chỉ khớp định kỳ theo lượt (`restrictedPhaseAt`).
   * Không có: mã theo phiên của bảng.
   */
  function phaseOf(quote: SymbolQuote, seconds: number): SymbolPhase | undefined {
    if (quote.trading_status !== 'RESTRICTED' || !quote.board) return undefined
    const rules = rulesFor(quote.board, tradingDate)
    if (!rules.restricted) return undefined
    const phase = restrictedPhaseAt(seconds, rules)
    return { session: phase.session, call_end: phase.callEnd, call_id: phase.callId }
  }

  /** Phiên của một mã: phiên riêng (mã hạn chế), không thì theo bảng; mã ngừng giao dịch coi như đóng cửa. */
  function quoteSession(quote: SymbolQuote, sessions: Partial<Record<Board, SessionCode>>, seconds: number): SessionCode {
    if (quote.board === null) return 'CLOSED'
    return phaseOf(quote, seconds)?.session ?? sessions[quote.board ?? 'STO'] ?? 'CLOSED'
  }

  /** Khóa nhận biết "vừa hết một lượt khớp": mã lượt với mã hạn chế, tên phiên với mã thường. */
  function callKey(quote: SymbolQuote, sessions: Partial<Record<Board, SessionCode>>, seconds: number) {
    return phaseOf(quote, seconds)?.call_id ?? quoteSession(quote, sessions, seconds)
  }

  function withPhase(quote: SymbolQuote): SymbolQuote {
    const phase = phaseOf(quote, simSeconds)
    return phase ? { ...quote, phase } : quote
  }

  function getState(): MarketState {
    return {
      trading_date: tradingDate,
      sim_seconds: simSeconds,
      quote_age_seconds: Math.floor(quoteAgeMs / 1000),
      session: getSessionAt(simSeconds, stoRules()),
      board_sessions: boardSessions(simSeconds),
      speed,
      quotes: quotes.map(withPhase),
    }
  }

  function notify() {
    const state = getState()
    listeners.forEach((listener) => listener(state))
  }

  /** Bước giá ngẫu nhiên từ -2 đến 2, bỏ giá trị 0, luôn nằm trong biên độ. */
  function randomWalk(price: number, quote: SymbolQuote, rand: RandomFn): number {
    const magnitude = rand() < 0.75 ? 1 : 2
    const steps = rand() < 0.5 ? -magnitude : magnitude
    const { rules } = contextOf(quote, tradingDate)
    return clamp(step(quote, price, steps, tradingDate), Math.max(quote.floor_price, rules.minPrice), quote.ceiling_price)
  }

  /** Ghi nhận một lần khớp: cập nhật giá khớp, KL, giá mua bán. */
  function withMatch(quote: SymbolQuote, price: number, qty: number): SymbolQuote {
    const { rules } = contextOf(quote, tradingDate)
    const low = Math.max(quote.floor_price, rules.minPrice)
    return {
      ...quote,
      last_price: price,
      indicative_price: null,
      last_qty: qty,
      total_volume: quote.total_volume + qty,
      bid_price: clamp(step(quote, price, -1, tradingDate), low, quote.ceiling_price),
      ask_price: clamp(step(quote, price, 1, tradingDate), low, quote.ceiling_price),
      tick_direction: Math.sign(price - quote.last_price) as SymbolQuote['tick_direction'],
    }
  }

  function nextQuote(quote: SymbolQuote): SymbolQuote {
    const rand = randomOf(quote.symbol)
    if (rand() > TRADE_PROBABILITY) return { ...quote, tick_direction: 0 }
    const price = randomWalk(quote.last_price, quote, rand)
    return withMatch(quote, price, (1 + Math.floor(rand() * 50)) * QTY_LOT_SIZE)
  }

  /** Trong ATO, ATC chỉ giá dự kiến thay đổi. Giá khớp và KL đứng yên cho tới lúc khớp định kỳ. */
  function nextIndicative(quote: SymbolQuote): SymbolQuote {
    const rand = randomOf(quote.symbol)
    const current = getDisplayPrice(quote)
    if (rand() > TRADE_PROBABILITY) return { ...quote, indicative_price: current, tick_direction: 0 }
    const price = randomWalk(current, quote, rand)
    return { ...quote, indicative_price: price, tick_direction: Math.sign(price - current) as SymbolQuote['tick_direction'] }
  }

  /** Hết phiên ATO, ATC: khớp một lần duy nhất theo giá dự kiến. KL định kỳ lớn hơn một nhịp thường. */
  function matchAuction(quote: SymbolQuote): SymbolQuote {
    const qty = (50 + Math.floor(randomOf(quote.symbol)() * 200)) * QTY_LOT_SIZE
    return withMatch(quote, getDisplayPrice(quote), qty)
  }

  /** Mã nào có KL khớp tăng trong nhịp này thì phát một tick khớp: giá khớp mới, KL phần tăng thêm. */
  function emitTrades(before: SymbolQuote[]) {
    const time = `${tradingDate}T${formatClock(simSeconds)}`
    const trades: MarketTrade[] = []
    quotes.forEach((quote, index) => {
      const qty = quote.total_volume - (before[index]?.total_volume ?? 0)
      if (qty <= 0) return
      trades.push({ symbol: quote.symbol, time, price: quote.last_price, qty })
      const stats = dayStats.get(quote.symbol) ?? { value: 0, volume: 0 }
      dayStats.set(quote.symbol, { value: stats.value + quote.last_price * qty, volume: stats.volume + qty })
    })
    if (trades.length > 0 && tradeListeners.size > 0) tradeListeners.forEach((listener) => listener(trades))
  }

  /** Một nhịp giả lập: tua đồng hồ theo tốc độ, rồi cho giá nhảy theo phiên của bảng giao dịch từng mã. */
  function tick(elapsedMs = TICK_INTERVAL_MS) {
    // Chế độ có kịch bản (Demo): đồng hồ và giá chỉ đổi theo lệnh của kịch bản.
    if (scripted) return
    const previous = boardSessions(simSeconds)
    const previousTime = simSeconds
    let next = Math.min(simSeconds + (elapsedMs / 1000) * speed, END_SECONDS)
    // Không tua vượt giờ khớp định kỳ của bảng nào, để luôn khớp đúng giờ (09:15:00, 14:45:00) ở mọi tốc độ.
    for (const board of BOARDS) {
      const session = previous[board]
      const rules = resolveRules(board, tradingDate)
      if (!session || !rules || !isAuctionSession(session)) continue
      const end = sessionEndAt(simSeconds, rules)
      if (end !== null) next = Math.min(next, end)
    }
    // Mã hạn chế: không tua vượt giờ khớp của lượt định kỳ đang chạy.
    for (const quote of quotes) {
      const end = phaseOf(quote, simSeconds)?.call_end
      if (end != null && end > simSeconds) next = Math.min(next, end)
    }
    simSeconds = next

    if (feedStale) {
      quoteAgeMs += elapsedMs
      quotes = quotes.map((quote) => ({ ...quote, tick_direction: 0 }))
      notify()
      return
    }

    quoteAgeMs = 0
    const current = boardSessions(simSeconds)
    const before = quotes
    const previousSeconds = previousTime
    quotes = quotes.map((quote) => {
      const was = quoteSession(quote, previous, previousSeconds)
      const now = quoteSession(quote, current, simSeconds)
      const depthRand = depthRandomOf(quote.symbol)
      // Hết phiên định kỳ (ATO, ATC, hoặc một lượt của mã hạn chế): khớp một lần theo giá dự kiến.
      const callEnded = callKey(quote, previous, previousSeconds) !== callKey(quote, current, simSeconds)
      if (isAuctionSession(was) && callEnded) return withDepth(matchAuction(quote), depthRand)
      if (isAuctionSession(now)) return nextIndicative(quote)
      if (now === 'CONTINUOUS') {
        const moved = withDepth(nextQuote(quote), depthRand)
        return moved.depth ? { ...moved, depth: replenishDepth(moved.depth, depthRand) } : moved
      }
      return { ...quote, tick_direction: 0 }
    })
    emitTrades(before)
    notify()
  }

  /** Giá tham chiếu ngày mới: giá đóng cửa, hoặc bình quân gia quyền phiên trước (UPCoM), làm tròn đúng bước giá. */
  function nextReference(quote: SymbolQuote): number {
    const { rules, secType } = contextOf(quote, tradingDate)
    const stats = dayStats.get(quote.symbol)
    if (rules.referencePrice !== 'VWAP_PREV' || !stats || stats.volume === 0) return quote.last_price
    const vwap = stats.value / stats.volume
    const tick = getTickSize(vwap, secType, rules)
    return Math.max(rules.minPrice, Math.round(vwap / tick) * tick)
  }

  /** Sang ngày `date`: giá tham chiếu từ ngày cũ, bảng và trần/sàn theo luật của ngày mới. */
  function startDay(date: string) {
    const entries = quotes.map((quote) => ({ symbol: quote.symbol, ref_price: nextReference(quote), foreign_room: quote.foreign_room }))
    tradingDate = date
    simSeconds = START_SECONDS
    quoteAgeMs = 0
    dayStats = new Map()
    quotes = buildQuotes(entries)
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
    /** Phát lại trạng thái hiện tại (ví dụ sau khi nạp pack thử nghiệm: phiên tính lại theo pack mới). */
    refresh: notify,
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
    /**
     * Đặt sổ lệnh nhiều mức cho mã; giá mua, bán tốt nhất theo mức đầu của sổ lệnh.
     * Truyền undefined để bỏ, engine dùng sổ lệnh tất định.
     */
    setDepth(symbol: string, depth: OrderBookDepth | undefined) {
      quotes = quotes.map((quote) => (quote.symbol === symbol ? syncBestFromDepth({ ...quote, depth }) : quote))
      notify()
    },
    /**
     * Lệnh của OMS vừa lấy `qty` ở mức `price` phía `side` của sổ lệnh: trừ KL, dồn mức, cập nhật giá tốt nhất.
     * Không phát trạng thái (gọi từ trong nhịp của engine); nhịp sau mọi nơi thấy sổ lệnh mới. Trả về KL thực lấy được.
     */
    consumeDepth(symbol: string, side: BookSide, price: number, qty: number): number {
      let taken = 0
      quotes = quotes.map((quote) => {
        if (quote.symbol !== symbol || !quote.depth) return quote
        const result = consumeLevel(quote.depth, side, price, qty, quote, depthRandomOf(symbol))
        taken = result.taken
        return syncBestFromDepth({ ...quote, depth: result.depth })
      })
      return taken
    },
    /**
     * Room ngoại của mã đổi `delta` cổ phiếu (âm: lệnh mua của nhà đầu tư nước ngoài vừa giữ room).
     * Không phát trạng thái, giống consumeDepth.
     */
    adjustForeignRoom(symbol: string, delta: number) {
      quotes = quotes.map((quote) =>
        quote.symbol === symbol && quote.foreign_room !== undefined
          ? { ...quote, foreign_room: Math.max(0, quote.foreign_room + delta) }
          : quote,
      )
    },
    /** Nhảy tới giờ giả lập (giây trong ngày), phát trạng thái để engine chạy một nhịp. */
    jumpTo(seconds: number) {
      simSeconds = Math.min(Math.max(seconds, 0), END_SECONDS)
      notify()
    },
    /** Tua thêm `seconds` giây giả lập, mỗi giây một nhịp. Giá đứng yên; đang bơm giá trễ thì tuổi giá tăng. */
    advance(seconds: number) {
      for (let index = 0; index < seconds && simSeconds < END_SECONDS; index += 1) {
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
      dayStats = new Map()
      quotes = buildQuotes(symbols)
      notify()
    },
    /** Sang ngày giao dịch mới: giá đóng cửa hôm trước thành giá tham chiếu hôm nay. */
    nextDay() {
      startDay(nextTradingDate(tradingDate))
      notify()
    },
    /**
     * Đổi ngày mô phỏng sang `date` (YYYY-MM-DD, ngày giao dịch, không lùi về quá khứ), không tải lại trang.
     * Chốt ngày cũ trước (tua tới 15:00 để engine cho lệnh trong ngày hết hiệu lực, mang lệnh nhiều phiên sang),
     * rồi dựng bảng giá ngày mới theo luật của ngày đó: mã niêm yết HNX đổi bảng, trần/sàn theo pack mới.
     */
    setTradingDate(date: string, options: { allowPast?: boolean } = {}) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isTradingDay(date)) throw new Error(`Ngày ${date} không phải ngày giao dịch`)
      // Chế độ Demo được đặt ngày tùy ý (kịch bản dựng dữ liệu riêng); người dùng chỉ đi tới.
      if (date < tradingDate && !options.allowPast) throw new Error('Không lùi ngày mô phỏng về quá khứ')
      if (date === tradingDate) return
      simSeconds = END_SECONDS
      notify()
      startDay(date)
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
      // Bản lưu cũ chưa có sổ lệnh: sinh mới (mã ngừng giao dịch không có sổ lệnh).
      quotes = state.quotes.map((quote) =>
        quote.depth || quote.board === null ? quote : withDepth(quote, depthRandomOf(quote.symbol)),
      )
    },
  }
}

export const marketSimulator = createMarketSimulator()

export type MarketSimulator = ReturnType<typeof createMarketSimulator>
