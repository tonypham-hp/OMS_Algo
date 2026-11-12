import { createOrderEngine, type SeedData } from '@/mocks/engine'
import { createMarketTape } from '@/mocks/marketTape'
import { createMarketSimulator } from '@/mocks/simulator'
import type { DemoContext, DemoEnv } from './types'

/** Bộ sinh số giả ngẫu nhiên có seed (LCG): cùng seed luôn ra cùng dãy. */
export function createLcg(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 2 ** 32
  }
}

/** Dữ liệu rỗng: kịch bản bắt đầu từ sổ lệnh trống. */
export function createEmptySeed(): SeedData {
  return {
    orders: [],
    parameters: new Map(),
    conditions: [],
    children: [],
    executions: [],
    snapshots: new Map(),
    events: [],
    notifications: [],
  }
}

export function createDemoContext(): DemoContext {
  return { refs: {}, marks: {}, disk: null, beforeCrash: null, missedReports: [], matchSequence: 0 }
}

/**
 * Bộ engine + giả lập + băng tick riêng, nối với nhau như runtime của app.
 * Dùng cho test và chạy headless: không đụng tới dữ liệu của app.
 */
export function createDemoEnv(options: { startDate?: Date; account?: string } = {}): DemoEnv {
  const simulator = createMarketSimulator({ startDate: options.startDate ?? new Date(2026, 10, 12), random: () => 0.5 })
  const engine = createOrderEngine()
  const tape = createMarketTape()
  const recorded = new Set<string>()

  simulator.onTrades((trades) => tape.record(trades))
  simulator.subscribe((state) => {
    engine.onMarketTick(state)
    // Lần khớp của OMS cũng là KL thị trường (giống runtime của app); ghi theo mã khớp để không ghi trùng.
    const fresh = engine.listExecutions().filter((execution) => !recorded.has(execution.exchange_match_id))
    if (fresh.length === 0) return
    fresh.forEach((execution) => recorded.add(execution.exchange_match_id))
    tape.record(
      fresh.map((execution) => ({
        symbol: engine.getOrder(execution.parent_order_id).symbol,
        time: execution.match_time,
        price: execution.price,
        qty: execution.qty,
      })),
    )
  })

  return { engine, simulator, tape, account: options.account ?? '058C999999', userId: 'demo' }
}
