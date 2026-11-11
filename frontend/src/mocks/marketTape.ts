import type { MarketTrade } from '@/types'

/** Số ngày giao dịch giữ lại: đủ cho bộ lọc "5 phiên" của báo cáo hiệu quả. */
export const TAPE_KEEP_DATES = 5
/** Trần số tick, để bản lưu trong localStorage không quá lớn khi chạy x1 cả ngày. */
export const TAPE_MAX_TRADES = 40_000

/** Dạng gọn khi lưu: [mã, thời điểm, giá, KL]. */
export type TapeEntry = [symbol: string, time: string, price: number, qty: number]

export interface TapeState {
  trades: TapeEntry[]
}

const dateOf = (time: string) => time.slice(0, 10)

/**
 * Băng tick khớp toàn thị trường, theo từng mã. Gồm lần khớp của bộ giả lập và lần khớp của chính OMS,
 * vì lệnh của mình cũng là một phần KL khớp của thị trường.
 */
export function createMarketTape(options: { keepDates?: number; maxTrades?: number } = {}) {
  const keepDates = options.keepDates ?? TAPE_KEEP_DATES
  const maxTrades = options.maxTrades ?? TAPE_MAX_TRADES
  /** Theo mã, mỗi danh sách xếp theo thời điểm tăng dần. */
  let bySymbol = new Map<string, MarketTrade[]>()
  let count = 0

  function insert(trade: MarketTrade) {
    const list = bySymbol.get(trade.symbol) ?? []
    // Tick gần như luôn tới theo thứ tự thời gian: chỉ phải dời khi có tick mẫu chen giữa.
    let index = list.length
    while (index > 0 && list[index - 1].time > trade.time) index -= 1
    list.splice(index, 0, trade)
    bySymbol.set(trade.symbol, list)
    count += 1
  }

  /** Bỏ ngày cũ, chỉ giữ `keepDates` ngày gần nhất; vượt trần thì bỏ tick cũ nhất. */
  function prune() {
    const dates = new Set<string>()
    bySymbol.forEach((list) => list.forEach((trade) => dates.add(dateOf(trade.time))))
    const kept = [...dates].sort().slice(-keepDates)
    const oldest = kept[0] ?? ''
    let all: MarketTrade[] = []
    bySymbol.forEach((list) => {
      all = all.concat(list.filter((trade) => dateOf(trade.time) >= oldest))
    })
    if (all.length > maxTrades) {
      all.sort((a, b) => a.time.localeCompare(b.time))
      all = all.slice(all.length - maxTrades)
    }
    load(all)
  }

  function load(trades: MarketTrade[]) {
    bySymbol = new Map()
    count = 0
    ;[...trades].sort((a, b) => a.time.localeCompare(b.time)).forEach(insert)
  }

  return {
    /** Ghi tick mới. Sang ngày mới hoặc vượt trần thì dọn bớt dữ liệu cũ. */
    record(trades: MarketTrade[]) {
      const knownDates = new Set<string>()
      bySymbol.forEach((list) => {
        if (list.length > 0) knownDates.add(dateOf(list[list.length - 1].time))
      })
      let newDate = false
      for (const trade of trades) {
        if (trade.qty <= 0) continue
        if (!knownDates.has(dateOf(trade.time))) newDate = true
        insert(trade)
      }
      if (newDate || count > maxTrades) prune()
    },
    /** Tick của một mã trong khoảng [from, to], tính cả hai đầu. */
    list(symbol: string, from: string, to: string): MarketTrade[] {
      return (bySymbol.get(symbol) ?? []).filter((trade) => trade.time >= from && trade.time <= to)
    },
    size: () => count,
    load,
    reset: () => load([]),
    exportState(): TapeState {
      const trades: TapeEntry[] = []
      bySymbol.forEach((list) => list.forEach((trade) => trades.push([trade.symbol, trade.time, trade.price, trade.qty])))
      return { trades }
    },
    importState(state: TapeState) {
      load(state.trades.map(([symbol, time, price, qty]) => ({ symbol, time, price, qty })))
    },
  }
}

export type MarketTape = ReturnType<typeof createMarketTape>
