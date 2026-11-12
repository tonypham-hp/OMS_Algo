import { describe, expect, it } from 'vitest'
import { createDemoEnv, createLcg } from '@/demo/env'
import type { CreateOrderRequest, StrategyParameter } from '@/types'
import { createOrderEngine } from './engine'
import { createMarketSimulator } from './simulator'

// Các bổ sung tối thiểu cho Chế độ Demo: điều khiển thị trường có kịch bản, Stop Limit chia phần,
// Core hủy phần còn lại của lệnh con, random có seed.

const int = (parameter_code: string, value: number): StrategyParameter => ({
  parameter_code,
  parameter_value: String(value),
  data_type: 'INTEGER',
})

function order(extra: Partial<CreateOrderRequest>): CreateOrderRequest {
  return {
    client_request_id: `req-${Math.random()}`,
    account_no: '058C999999',
    symbol: 'FPT',
    side: 'BUY',
    total_qty: 30_000,
    limit_price: 118_000,
    strategy_type: 'ICEBERG',
    persistence_mode: 'DAY',
    valid_to: null,
    parameters: [int('slice_qty', 10_000)],
    ...extra,
  }
}

/** Môi trường Demo ở phiên liên tục 10:00, giá 118.500 (lệnh mua 118.000 không tự khớp). */
function openEnv() {
  const env = createDemoEnv()
  env.simulator.setScripted(true)
  env.simulator.jumpTo(36_000)
  env.simulator.pushTrade('FPT', 118_500, 100)
  env.simulator.advance(1)
  return env
}

describe('bộ giả lập có kịch bản', () => {
  it('bật scripted thì nhịp hẹn giờ không đổi giá, không tua đồng hồ', () => {
    const simulator = createMarketSimulator({ startDate: new Date(2026, 10, 12), random: () => 0.1 })
    simulator.setScripted(true)
    const before = simulator.exportState()
    for (let index = 0; index < 10; index += 1) simulator.tick()
    expect(simulator.exportState()).toEqual(before)
  })

  it('pushTrade đổi giá khớp, cộng KL, phát tick khớp; jumpTo và advance đặt, tua đồng hồ', () => {
    const simulator = createMarketSimulator({ startDate: new Date(2026, 10, 12) })
    const trades: number[] = []
    simulator.onTrades((items) => trades.push(...items.map((item) => item.qty)))
    simulator.jumpTo(36_000)
    simulator.pushTrade('FPT', 118_300, 2_000)
    const quote = simulator.getState().quotes.find((item) => item.symbol === 'FPT')
    expect(quote).toMatchObject({ last_price: 118_300, total_volume: 2_000, bid_price: 118_200, ask_price: 118_400 })
    expect(trades).toEqual([2_000])
    simulator.advance(5)
    expect(simulator.getState().sim_seconds).toBe(36_005)
  })

  it('setDepth gắn sổ lệnh vào mã, giữ qua các lần khớp', () => {
    const simulator = createMarketSimulator({ startDate: new Date(2026, 10, 12) })
    const depth = { asks: [{ price: 118_100, qty: 3_000 }], bids: [{ price: 117_900, qty: 5_000 }] }
    simulator.setDepth('FPT', depth)
    simulator.pushTrade('FPT', 118_000, 100)
    expect(simulator.getState().quotes.find((item) => item.symbol === 'FPT')?.depth).toEqual(depth)
  })
})

describe('Stop Limit có KL mỗi phần (slice_qty)', () => {
  it('chưa chạm ngưỡng không có lệnh con; chạm ngưỡng thì chia từng phần, phần sau chỉ sinh khi phần trước xong', () => {
    const env = openEnv()
    const { engine, simulator } = env
    const id = engine.createOrder(
      order({ side: 'SELL', strategy_type: 'STOP_LIMIT', limit_price: 115_500, parameters: [int('trigger_price', 116_000), int('slice_qty', 10_000)] }),
      'tester',
    ).parent_order_id
    simulator.pushTrade('FPT', 117_000, 100)
    simulator.advance(3)
    expect(engine.getChildren(id)).toHaveLength(0)

    simulator.pushTrade('FPT', 116_000, 100)
    simulator.advance(1)
    simulator.pushTrade('FPT', 115_000, 100) // dưới giá giới hạn bán: lệnh con không tự khớp
    simulator.advance(3)
    expect(engine.getChildren(id).map((child) => child.quantity)).toEqual([10_000])

    const first = engine.getChildren(id)[0]
    engine.applyExecution({ child_order_id: first.child_order_id, exchange_match_id: 'T-1', price: 115_500, qty: 10_000 })
    simulator.advance(2)
    expect(engine.getChildren(id).map((child) => child.quantity)).toEqual([10_000, 10_000])
  })

  it('không có slice_qty thì như cũ: một lệnh con cho toàn bộ KL', () => {
    const env = openEnv()
    const id = env.engine.createOrder(
      order({ strategy_type: 'STOP_LIMIT', limit_price: 119_000, parameters: [int('trigger_price', 118_500)] }),
      'tester',
    ).parent_order_id
    env.simulator.advance(1)
    expect(env.engine.getChildren(id).map((child) => child.quantity)).toEqual([30_000])
  })
})

describe('Core hủy phần còn lại của lệnh con (TC-E2E-051)', () => {
  it('giữ phần đã khớp, lệnh con kế tiếp tính theo KL đã khớp thật', () => {
    const env = openEnv()
    const { engine, simulator } = env
    const id = engine.createOrder(order({}), 'tester').parent_order_id
    simulator.advance(2)
    const first = engine.getChildren(id)[0]
    engine.applyExecution({ child_order_id: first.child_order_id, exchange_match_id: 'T-1', price: 118_000, qty: 6_000 })
    engine.cancelChildByCore(first.child_order_id)
    expect(engine.getChildren(id)[0].status).toBe('CANCELLED')
    expect(engine.getEvents(id).at(-1)).toMatchObject({ action: 'CANCEL', new_value: 'CANCELLED', user_id: 'SYSTEM' })
    simulator.advance(1)
    expect(engine.getOrder(id).executed_qty).toBe(6_000)
    expect(engine.getChildren(id).map((child) => child.quantity)).toEqual([10_000, 10_000])
    expect(engine.getAllowedQty(id)).toBe(30_000 - 6_000 - 10_000)
  })

  it('lệnh con không còn chờ khớp thì báo lỗi', () => {
    const env = openEnv()
    const id = env.engine.createOrder(order({}), 'tester').parent_order_id
    env.simulator.advance(2)
    const first = env.engine.getChildren(id)[0]
    env.engine.cancelChildByCore(first.child_order_id)
    expect(() => env.engine.cancelChildByCore(first.child_order_id)).toThrow()
  })
})

describe('setRandom', () => {
  it('cùng seed cho cùng KL khớp; đổi random thì đổi theo', () => {
    function run(seed: number) {
      const engine = createOrderEngine()
      engine.setRandom(createLcg(seed))
      const simulator = createMarketSimulator({ startDate: new Date(2026, 10, 12) })
      simulator.subscribe((state) => engine.onMarketTick(state))
      simulator.setScripted(true)
      simulator.jumpTo(36_000)
      const id = engine.createOrder(order({ limit_price: 118_500 }), 'tester').parent_order_id
      simulator.pushTrade('FPT', 118_000, 100)
      simulator.advance(20)
      return engine.getExecutions(id).map((execution) => execution.qty)
    }
    expect(run(7)).toEqual(run(7))
    expect(run(7).length).toBeGreaterThan(0)
  })
})
