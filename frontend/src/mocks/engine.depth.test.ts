import { describe, expect, it } from 'vitest'
import type { CreateOrderRequest, MarketState, OrderBookDepth, Side, SymbolQuote } from '@/types'
import { findSweepPlan } from '@/utils/huntSweep'
import { createOrderEngine } from './engine'

// HUNT quét sổ lệnh có thật (quote.depth): lệnh con quét khớp tại giá của mức, tối đa KL của mức.
const hhmm = (hour: number, minute: number) => hour * 3600 + minute * 60
const TODAY = '2026-11-13'

const BOOK: OrderBookDepth = {
  asks: [
    { price: 27_650, qty: 6_400 },
    { price: 27_700, qty: 9_800 },
    { price: 27_750, qty: 5_000 },
  ],
  bids: [
    { price: 27_550, qty: 5_000 },
    { price: 27_500, qty: 4_000 },
    { price: 27_450, qty: 3_000 },
  ],
}

function quote(last: number, depth: OrderBookDepth): SymbolQuote {
  return {
    symbol: 'HPG',
    ref_price: 27_500,
    ceiling_price: 29_400,
    floor_price: 25_600,
    last_price: last,
    indicative_price: null,
    last_qty: 100,
    total_volume: 0,
    bid_price: depth.bids[0]?.price ?? last - 50,
    ask_price: depth.asks[0]?.price ?? last + 50,
    tick_direction: 0,
    depth,
  }
}

function market(seconds: number, last: number, depth: OrderBookDepth): MarketState {
  return { trading_date: TODAY, sim_seconds: seconds, quote_age_seconds: 0, session: 'CONTINUOUS', speed: 1, quotes: [quote(last, depth)] }
}

function hunt(side: Side, qty: number, limit: number, huntPrice: number, passive: 0 | 1): CreateOrderRequest {
  const int = (code: string, value: number) => ({ parameter_code: code, parameter_value: String(value), data_type: 'INTEGER' as const })
  return {
    client_request_id: `R-${side}`,
    account_no: '058C000001',
    symbol: 'HPG',
    side,
    total_qty: qty,
    limit_price: limit,
    strategy_type: 'HUNT',
    persistence_mode: 'DAY',
    valid_to: null,
    parameters: [int('hunt_price', huntPrice), int('max_wait_min', 30), int('max_levels', 3), int('remainder_passive', passive)],
  }
}

/** Chạy engine với sổ lệnh "sống": mỗi lần OMS lấy KL thì trừ khỏi sổ lệnh, như runtime của app. */
function run(request: CreateOrderRequest, last: number, ticks = 15) {
  const engine = createOrderEngine({ random: () => 0 })
  let depth: OrderBookDepth = structuredClone(BOOK)
  let seconds = hhmm(10, 0)
  engine.onMarketTick(market(seconds, 27_800, depth))
  const order = engine.createOrder(request, 'dealer')
  const takenAt = new Map<number, number>()
  for (let tick = 0; tick < ticks; tick += 1) {
    seconds += 1
    engine.onMarketTick(market(seconds, last, depth))
    for (const take of engine.drainDepthTakes()) {
      takenAt.set(take.price, (takenAt.get(take.price) ?? 0) + take.qty)
      depth = {
        ...depth,
        [take.side]: depth[take.side]
          .map((level) => (level.price === take.price ? { ...level, qty: level.qty - take.qty } : level))
          .filter((level) => level.qty > 0),
      }
    }
  }
  const id = order.parent_order_id
  return { engine, id, takenAt, depth, order: engine.getOrder(id), executions: engine.getExecutions(id), events: engine.getEvents(id) }
}

describe('HUNT khớp theo sổ lệnh', () => {
  it('MUA 8.000: lấy 6.400 @27.650 + 1.600 @27.700, giá BQ 27.660, mức 27.650 hết KL', () => {
    const result = run(hunt('BUY', 8_000, 27_800, 27_600, 1), 27_600)
    const filled = result.executions.reduce((sum, execution) => sum + execution.qty, 0)
    const value = result.executions.reduce((sum, execution) => sum + execution.qty * execution.price, 0)
    expect(result.order.status).toBe('COMPLETED')
    expect(filled).toBe(8_000)
    expect(value / filled).toBe(27_660)
    expect(result.takenAt.get(27_650)).toBe(6_400)
    expect(result.takenAt.get(27_700)).toBe(1_600)
    expect(result.depth.asks[0]).toEqual({ price: 27_700, qty: 8_200 })
    const plan = findSweepPlan(result.events)
    expect(plan?.steps.map((step) => step.status)).toEqual(['TAKE', 'TAKE', 'UNUSED'])
    expect(plan?.book?.asks[0]).toEqual({ price: 27_650, qty: 6_400 })
  })

  it('không vượt giá tối đa; hết mức trong giới hạn thì phần còn lại chờ ở giá mua tốt nhất', () => {
    const result = run(hunt('BUY', 20_000, 27_700, 27_600, 1), 27_600)
    expect(result.executions.every((execution) => execution.price <= 27_700)).toBe(true)
    expect(result.takenAt.get(27_750)).toBeUndefined()
    const children = result.engine.getChildren(result.id)
    expect(children).toHaveLength(3)
    expect(children[2]).toMatchObject({ price: 27_550, quantity: 3_800 })
    expect(result.order.executed_qty).toBeLessThanOrEqual(result.order.total_qty)
  })

  it('hết mức trong giới hạn, tùy chọn hủy: lệnh kết thúc, không đặt chờ', () => {
    const result = run(hunt('BUY', 20_000, 27_700, 27_600, 0), 27_600)
    expect(result.order.status).toBe('EXPIRED')
    expect(result.order.executed_qty).toBe(16_200)
    expect(result.engine.getChildren(result.id)).toHaveLength(2)
  })

  it('BÁN đối xứng: quét từ giá mua cao nhất xuống, không thấp hơn giá tối thiểu', () => {
    const result = run(hunt('SELL', 12_000, 27_500, 27_600, 0), 27_600)
    expect(result.takenAt.get(27_550)).toBe(5_000)
    expect(result.takenAt.get(27_500)).toBe(4_000)
    expect(result.takenAt.get(27_450)).toBeUndefined()
    expect(result.executions.every((execution) => execution.price >= 27_500)).toBe(true)
    expect(result.order.executed_qty).toBe(9_000)
  })
})
