import { describe, expect, it } from 'vitest'
import { iso, makeChild, makeEvent, makeExecution, makeOrder, TODAY, YESTERDAY } from '@/test/fixtures'
import type { DashboardData, MarketSnapshot } from '@/types'
import {
  getAttention,
  getAverageSlippageBps,
  getFilledToday,
  getRecentActivity,
  getRunningStats,
} from './dashboard'

const snapshot = (price: number): MarketSnapshot => ({
  arrival_price: price,
  arrival_bid: price - 100,
  arrival_ask: price + 100,
  arrival_timestamp: iso(TODAY, '09:00:00'),
})

function makeData(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    trading_date: TODAY,
    orders: [],
    children: [],
    executions: [],
    snapshots: {},
    pause_reasons: {},
    events: [],
    ...overrides,
  }
}

describe('getRunningStats', () => {
  it('đếm lệnh chưa kết thúc là đang chạy, trong đó tách số đang tạm dừng', () => {
    const orders = [
      makeOrder('A', { status: 'ACTIVE' }),
      makeOrder('B', { status: 'PARTIALLY_EXECUTED' }),
      makeOrder('C', { status: 'PAUSED_USER' }),
      makeOrder('D', { status: 'PAUSED_SYSTEM' }),
      makeOrder('E', { status: 'CANCEL_PENDING' }),
      makeOrder('F', { status: 'COMPLETED' }),
      makeOrder('G', { status: 'CANCELLED' }),
      makeOrder('H', { status: 'EXPIRED' }),
      makeOrder('I', { status: 'DRAFT' }),
    ]
    expect(getRunningStats(orders)).toEqual({ running: 5, paused: 2 })
  })

  it('không có lệnh thì 0', () => {
    expect(getRunningStats([])).toEqual({ running: 0, paused: 0 })
  })
})

describe('getAttention', () => {
  it('đếm riêng lệnh con UNKNOWN, REJECTED và lệnh PAUSED_SYSTEM; mỗi lệnh một dòng cho mỗi loại', () => {
    const orders = [
      makeOrder('A'),
      makeOrder('B', { status: 'PAUSED_SYSTEM', reason_code: 'CHILD_REJECTED_REPEAT' }),
      makeOrder('C'),
    ]
    const children = [
      makeChild('A1', 'A', 'UNKNOWN'),
      makeChild('A2', 'A', 'UNKNOWN'),
      makeChild('B1', 'B', 'REJECTED'),
      makeChild('B2', 'B', 'REJECTED'),
      makeChild('C1', 'C', 'FILLED'),
    ]
    const result = getAttention(orders, children)

    expect(result.counts).toEqual({ UNKNOWN: 2, REJECTED: 2, PAUSED_SYSTEM: 1 })
    expect(result.orders).toBe(2)
    expect(result.items.map((item) => [item.order.parent_order_id, item.kind])).toEqual([
      ['A', 'UNKNOWN'],
      ['B', 'REJECTED'],
      ['B', 'PAUSED_SYSTEM'],
    ])
    expect(result.items[0].issue).toBe('2 lệnh con mất phản hồi từ Core, chờ đối soát')
    expect(result.items[2].issue).toBe('Hệ thống tạm dừng: core từ chối lặp lại')
  })

  it('lệnh không có reason_code: lấy lý do từ thông báo tạm dừng, không có thì câu chung', () => {
    const orders = [makeOrder('A', { status: 'PAUSED_SYSTEM' }), makeOrder('B', { status: 'PAUSED_SYSTEM' })]
    const reasons = { A: 'Lệnh A tạm dừng: một lệnh con mất phản hồi từ Core, đang chờ đối soát.' }
    const issues = getAttention(orders, [], reasons).items.map((item) => item.issue)
    expect(issues).toEqual([
      'Hệ thống tạm dừng: một lệnh con mất phản hồi từ Core, đang chờ đối soát',
      'Hệ thống tạm dừng lệnh',
    ])
  })

  it('bỏ qua lệnh con lỗi của lệnh đã kết thúc', () => {
    const orders = [makeOrder('A', { status: 'CANCELLED' })]
    const result = getAttention(orders, [makeChild('A1', 'A', 'REJECTED')])
    expect(result.items).toEqual([])
    expect(result.orders).toBe(0)
  })
})

describe('getFilledToday', () => {
  it('cộng KL khớp trong ngày, bỏ lần khớp ngày khác và lệnh thoát của Bracket', () => {
    const bracket = makeOrder('A', { strategy_type: 'BRACKET', total_qty: 1_000 })
    const iceberg = makeOrder('B', { total_qty: 2_000, created_at: iso(YESTERDAY, '10:00:00'), persistence_mode: 'MULTI_SESSION' })
    const children = [makeChild('A1', 'A', 'FILLED', 'BUY'), makeChild('A2', 'A', 'FILLED', 'SELL'), makeChild('B1', 'B', 'PARTIAL_FILLED')]
    const executions = [
      makeExecution('X1', 'A1', 'A', 1_000, 100_000),
      makeExecution('X2', 'A2', 'A', 1_000, 101_000),
      makeExecution('X3', 'B1', 'B', 300, 100_000, iso(YESTERDAY, '14:00:00')),
      makeExecution('X4', 'B1', 'B', 200, 100_000),
    ]
    const result = getFilledToday(makeData({ orders: [bracket, iceberg], children, executions }))
    expect(result).toEqual({ filled: 1_200, ordered: 3_000 })
  })

  it('lệnh đã kết thúc từ hôm trước không tính vào tổng đặt', () => {
    const old = makeOrder('A', { status: 'COMPLETED', created_at: iso(YESTERDAY, '09:00:00') })
    expect(getFilledToday(makeData({ orders: [old] }))).toEqual({ filled: 0, ordered: 0 })
  })
})

describe('getAverageSlippageBps', () => {
  it('mua cao hơn arrival là dương (bất lợi)', () => {
    const order = makeOrder('A', { side: 'BUY' })
    const data = makeData({
      orders: [order],
      children: [makeChild('A1', 'A', 'FILLED', 'BUY')],
      executions: [makeExecution('X1', 'A1', 'A', 1_000, 101_000)],
      snapshots: { A: snapshot(100_000) },
    })
    expect(getAverageSlippageBps(data)).toBeCloseTo(100)
  })

  it('bán thấp hơn arrival là dương, bán cao hơn là âm (có lợi)', () => {
    const sellLow = makeData({
      orders: [makeOrder('A', { side: 'SELL' })],
      children: [makeChild('A1', 'A', 'FILLED', 'SELL')],
      executions: [makeExecution('X1', 'A1', 'A', 1_000, 99_000)],
      snapshots: { A: snapshot(100_000) },
    })
    const sellHigh = { ...sellLow, executions: [makeExecution('X1', 'A1', 'A', 1_000, 100_500)] }
    expect(getAverageSlippageBps(sellLow)).toBeCloseTo(100)
    expect(getAverageSlippageBps(sellHigh)).toBeCloseTo(-50)
  })

  it('bình quân gia quyền theo KL khớp giữa các lệnh', () => {
    const data = makeData({
      orders: [makeOrder('A', { side: 'BUY' }), makeOrder('B', { side: 'SELL' })],
      children: [makeChild('A1', 'A', 'FILLED', 'BUY'), makeChild('B1', 'B', 'FILLED', 'SELL')],
      // A: +100 bps trên 300 CP; B: bán cao hơn 1% = −100 bps trên 100 CP → (30.000 − 10.000) / 400 = 50
      executions: [makeExecution('X1', 'A1', 'A', 300, 101_000), makeExecution('X2', 'B1', 'B', 100, 101_000)],
      snapshots: { A: snapshot(100_000), B: snapshot(100_000) },
    })
    expect(getAverageSlippageBps(data)).toBeCloseTo(50)
  })

  it('chưa khớp hoặc thiếu arrival thì null', () => {
    const noFill = makeData({ orders: [makeOrder('A')], snapshots: { A: snapshot(100_000) } })
    const noArrival = makeData({
      orders: [makeOrder('A')],
      children: [makeChild('A1', 'A', 'FILLED')],
      executions: [makeExecution('X1', 'A1', 'A', 100, 100_000)],
    })
    expect(getAverageSlippageBps(noFill)).toBeNull()
    expect(getAverageSlippageBps(noArrival)).toBeNull()
  })
})

describe('getRecentActivity', () => {
  it('lấy 10 event mới nhất, mới nhất trước, có giờ và mô tả tiếng Việt', () => {
    const events = Array.from({ length: 12 }, (_, index) =>
      makeEvent({ action: 'CHILD_CREATE', event_time: iso(TODAY, `09:${String(10 + index).padStart(2, '0')}:00`) }),
    )
    const result = getRecentActivity(events, 10, TODAY)
    expect(result).toHaveLength(10)
    expect(result[0].time).toBe('09:21:00')
    expect(result[9].time).toBe('09:12:00')
  })

  it('event cùng thời điểm: event xảy ra sau đứng trước', () => {
    const first = makeEvent({ action: 'CREATE', new_value: 'ACTIVE' })
    const second = makeEvent({ action: 'PAUSE', old_value: 'ACTIVE', new_value: 'PAUSED_USER' })
    const result = getRecentActivity([first, second], 10, TODAY)
    expect(result.map((item) => item.event_id)).toEqual([second.event_id, first.event_id])
    expect(result[0].description).toBe('Tạm dừng PO-1: Đang hoạt động → Tạm dừng')
  })

  it('event của ngày khác hiện kèm ngày', () => {
    const old = makeEvent({ action: 'CREATE', new_value: 'ACTIVE', event_time: iso(YESTERDAY, '09:08:00') })
    const now = makeEvent({ action: 'CREATE', new_value: 'ACTIVE', event_time: iso(TODAY, '09:01:00') })
    expect(getRecentActivity([old, now], 10, TODAY).map((item) => item.time)).toEqual(['09:01:00', '09/11 09:08:00'])
  })
})
