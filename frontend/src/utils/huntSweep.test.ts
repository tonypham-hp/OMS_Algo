import { describe, expect, it } from 'vitest'
import type { ChildOrder, Execution, HuntSweepPlan } from '@/types'
import { deriveHuntSweepView, describeHuntStep, findSweepPlan, planHuntSweep } from './huntSweep'

const ASKS = [
  { price: 27_650, qty: 6_400 },
  { price: 27_700, qty: 9_800 },
  { price: 27_750, qty: 5_000 },
]
const BIDS = [
  { price: 27_550, qty: 5_000 },
  { price: 27_500, qty: 4_000 },
  { price: 27_450, qty: 3_000 },
]

describe('HUNT quét từng mức (MUA)', () => {
  it('MUA 8.000 qua 2 mức: lấy 6.400 @27.650 + 1.600 @27.700, giá BQ 27.660', () => {
    const plan = planHuntSweep({ side: 'BUY', levels: ASKS, qty: 8_000, limitPrice: 27_800, maxLevels: 3 })
    expect(plan.steps.map((step) => [step.price, step.take, step.short_after, step.status])).toEqual([
      [27_650, 6_400, 1_600, 'TAKE'],
      [27_700, 1_600, 0, 'TAKE'],
      [27_750, 0, 0, 'UNUSED'],
    ])
    expect(plan.take_qty).toBe(8_000)
    expect(plan.avg_price).toBe(27_660)
    expect(plan.remainder).toBe(0)
    expect(describeHuntStep(plan.steps[0])).toBe('Quét mức 27.650: lấy 6.400, còn thiếu 1.600')
  })

  it('quét từ mức tốt nhất dù sổ lệnh đưa vào không theo thứ tự', () => {
    const plan = planHuntSweep({ side: 'BUY', levels: [...ASKS].reverse(), qty: 8_000, limitPrice: null })
    expect(plan.steps[0].price).toBe(27_650)
  })

  it('không vượt giá tối đa: mức trên giá tối đa không bị quét', () => {
    const plan = planHuntSweep({ side: 'BUY', levels: ASKS, qty: 20_000, limitPrice: 27_700, remainderPolicy: 'WAIT' })
    expect(plan.steps.filter((step) => step.take > 0).every((step) => step.price <= 27_700)).toBe(true)
    expect(plan.steps[2].status).toBe('OUT_OF_LIMIT')
    expect(plan.steps[2].take).toBe(0)
  })

  it('hết mức trong giới hạn: phần còn lại theo tùy chọn (chờ / hủy)', () => {
    const wait = planHuntSweep({ side: 'BUY', levels: ASKS, qty: 20_000, limitPrice: 27_700, remainderPolicy: 'WAIT' })
    expect(wait.take_qty).toBe(16_200)
    expect(wait.remainder).toBe(3_800)
    expect(wait.remainder_policy).toBe('WAIT')
    const cancel = planHuntSweep({ side: 'BUY', levels: ASKS, qty: 20_000, limitPrice: 27_700, remainderPolicy: 'CANCEL' })
    expect(cancel.remainder).toBe(3_800)
    expect(cancel.remainder_policy).toBe('CANCEL')
  })

  it('tổng lấy không vượt KL cần và không vượt KL từng mức', () => {
    for (const qty of [100, 6_400, 6_500, 16_200, 50_000]) {
      const plan = planHuntSweep({ side: 'BUY', levels: ASKS, qty, limitPrice: null })
      expect(plan.take_qty).toBeLessThanOrEqual(qty)
      expect(plan.take_qty + plan.remainder).toBe(qty)
      expect(plan.steps.every((step) => step.take <= step.available)).toBe(true)
    }
  })

  it('maxLevels giới hạn số mức được xét', () => {
    const plan = planHuntSweep({ side: 'BUY', levels: ASKS, qty: 20_000, limitPrice: null, maxLevels: 1 })
    expect(plan.steps).toHaveLength(1)
    expect(plan.take_qty).toBe(6_400)
  })
})

describe('HUNT BÁN đối xứng', () => {
  it('quét từ giá mua cao nhất xuống, không thấp hơn giá tối thiểu', () => {
    const plan = planHuntSweep({ side: 'SELL', levels: [...BIDS].reverse(), qty: 12_000, limitPrice: 27_500, remainderPolicy: 'CANCEL' })
    expect(plan.steps.map((step) => [step.price, step.take, step.status])).toEqual([
      [27_550, 5_000, 'TAKE'],
      [27_500, 4_000, 'TAKE'],
      [27_450, 0, 'OUT_OF_LIMIT'],
    ])
    expect(plan.remainder).toBe(3_000)
    expect(plan.avg_price).toBe(Math.round((5_000 * 27_550 + 4_000 * 27_500) / 9_000))
  })
})

describe('trạng thái từng bước trên màn hình', () => {
  const child = (id: string, cycle: number, price: number, quantity: number, filled: number, status: ChildOrder['status']): ChildOrder => ({
    child_order_id: id,
    parent_order_id: 'PO-1',
    cycle_no: cycle,
    side: 'BUY',
    order_type: 'LO',
    price,
    quantity,
    filled_qty: filled,
    status,
    client_order_id: `CL-${id}`,
    idempotency_key: `IDEM-${id}`,
    core_order_id: null,
    created_at: '2026-11-13T10:00:00',
    sent_at: null,
  })
  const fill = (id: string, childId: string, price: number, qty: number): Execution => ({
    execution_id: id,
    child_order_id: childId,
    parent_order_id: 'PO-1',
    exchange_match_id: `M-${id}`,
    price,
    qty,
    match_time: '2026-11-13T10:00:01',
  })

  it('đã khớp / đang chờ / không cần dùng, giá BQ thực tế, mức đang quét', () => {
    const plan: HuntSweepPlan = planHuntSweep({ side: 'BUY', levels: ASKS, qty: 8_000, limitPrice: 27_800 })
    plan.steps[0].child_order_id = 'C1'
    plan.steps[1].child_order_id = 'C2'
    const children = [child('C1', 1, 27_650, 6_400, 6_400, 'FILLED'), child('C2', 2, 27_700, 1_600, 0, 'ACKNOWLEDGED')]
    const view = deriveHuntSweepView(plan, children, [fill('X1', 'C1', 27_650, 6_400)])
    expect(view.steps.map((step) => step.state)).toEqual(['FILLED', 'WORKING', 'UNUSED'])
    expect(view.activePrice).toBe(27_700)
    expect(view.avgPrice).toBe(27_650)

    const done = deriveHuntSweepView(
      plan,
      [child('C1', 1, 27_650, 6_400, 6_400, 'FILLED'), child('C2', 2, 27_700, 1_600, 1_600, 'FILLED')],
      [fill('X1', 'C1', 27_650, 6_400), fill('X2', 'C2', 27_700, 1_600)],
    )
    expect(done.avgPrice).toBe(27_660)
    expect(done.activePrice).toBeNull()
  })

  it('phần còn lại chờ: nhận lệnh con sinh sau các lệnh quét', () => {
    const plan = planHuntSweep({ side: 'BUY', levels: ASKS.slice(0, 1), qty: 8_000, limitPrice: 27_650, remainderPolicy: 'WAIT' })
    plan.steps[0].child_order_id = 'C1'
    const view = deriveHuntSweepView(plan, [child('C1', 1, 27_650, 6_400, 6_400, 'FILLED'), child('C2', 2, 27_550, 1_600, 0, 'ACKNOWLEDGED')], [])
    expect(view.remainder?.text).toBe('Phần còn lại 1.600: chờ ở giá 27.550')
  })

  it('đọc kế hoạch quét gần nhất từ nhật ký', () => {
    const plan = planHuntSweep({ side: 'BUY', levels: ASKS, qty: 100, limitPrice: null })
    expect(findSweepPlan([{ action: 'CREATE' }, { action: 'DECISION', sweep_plan: plan }])).toBe(plan)
    expect(findSweepPlan([{ action: 'CREATE' }])).toBeNull()
  })
})
