import { describe, expect, it } from 'vitest'
import { parseTimeToSeconds } from '@/rules/session'
import type { CreateOrderRequest, MarketState, StrategyParameter } from '@/types'
import { createOrderEngine } from './engine'
import { createMarketSimulator } from './simulator'

// Phiên giao dịch đặc biệt theo KRX (Đợt 8B) chạy trên bộ giả lập + engine thật nối với nhau như runtime.

const at = (time: string) => parseTimeToSeconds(time) as number
const DOMESTIC = '058C123456'

function setup() {
  const simulator = createMarketSimulator({ startDate: new Date(2026, 10, 16), random: () => 0.5 })
  const engine = createOrderEngine({ random: () => 0, enforceRules: true })
  let last: MarketState = simulator.getState()
  simulator.setScripted(true)
  simulator.subscribe((state) => {
    last = state
    engine.onMarketTick(state)
    engine.drainRoomChanges().forEach((change) => simulator.adjustForeignRoom(change.symbol, change.delta))
  })
  const quote = (symbol: string) => last.quotes.find((item) => item.symbol === symbol)!
  return { simulator, engine, quote }
}

const request = (extra: Partial<CreateOrderRequest> = {}): CreateOrderRequest => ({
  client_request_id: `req-${Math.random()}`,
  account_no: DOMESTIC,
  symbol: 'XRS',
  side: 'BUY',
  total_qty: 1_000,
  limit_price: 14_300,
  strategy_type: 'LIMIT',
  persistence_mode: 'DAY',
  valid_to: null,
  parameters: [],
  ...extra,
})
const param = (code: string, value: number | string): StrategyParameter => ({
  parameter_code: code,
  parameter_value: String(value),
  data_type: typeof value === 'string' ? 'TIME' : 'INTEGER',
})

describe('mã hạn chế giao dịch (XRS) trên bộ giả lập + engine', () => {
  it('bảng giá có phiên riêng theo lượt; lệnh chỉ khớp lúc hết lượt, tại giá định kỳ', () => {
    const { simulator, engine, quote } = setup()
    simulator.jumpTo(at('09:20'))
    expect(quote('XRS')).toMatchObject({ trading_status: 'RESTRICTED', phase: { session: 'PERIODIC', call_end: at('09:30') } })
    expect(quote('FPT').phase).toBeUndefined()

    const id = engine.createOrder(request(), 'tester').parent_order_id
    simulator.pushTrade('XRS', 14_250, 100)
    simulator.advance(60)
    // Trong lượt: lệnh con LO đã lên sàn nhưng chưa khớp dù giá khớp thấp hơn giá mua.
    expect(engine.getChildren(id).map((child) => [child.order_type, child.status])).toEqual([['LO', 'ACKNOWLEDGED']])
    expect(engine.getOrder(id).executed_qty).toBe(0)

    // Vào 5 phút cuối lượt (PERIODIC → PERIODIC_LOCK, cùng lượt): chưa phải lúc khớp.
    simulator.jumpTo(at('09:26'))
    expect(quote('XRS').phase?.session).toBe('PERIODIC_LOCK')
    expect(engine.getOrder(id).executed_qty).toBe(0)

    simulator.jumpTo(at('09:30'))
    expect(engine.getOrder(id)).toMatchObject({ executed_qty: 1_000, status: 'COMPLETED' })
    expect(engine.getExecutions(id)[0]).toMatchObject({ price: 14_250, qty: 1_000, match_time: '2026-11-16T09:30:00' })
  })

  it('HUNT, MTL (Stop), lô lẻ bị từ chối với mã hạn chế', () => {
    const { simulator, engine } = setup()
    simulator.jumpTo(at('09:20'))
    expect(() => engine.createOrder(request({ strategy_type: 'HUNT', parameters: [param('hunt_price', 14_200), param('max_wait_min', 5)] }), 't')).toThrow('HUNT')
    expect(() => engine.createOrder(request({ strategy_type: 'STOP', limit_price: null, parameters: [param('trigger_price', 14_500)] }), 't')).toThrow('MTL')
    expect(() => engine.createOrder(request({ total_qty: 50, lot_type: 'ODD' }), 't')).toThrow('lô chẵn')
  })

  it('sửa, hủy bị khóa 5 phút cuối lượt kèm giờ khớp; ngoài cửa sổ khóa thì được', () => {
    const { simulator, engine } = setup()
    simulator.jumpTo(at('09:31'))
    const id = engine.createOrder(request({ limit_price: 13_500 }), 'tester').parent_order_id
    simulator.jumpTo(at('09:41'))
    expect(() => engine.cancelOrder(id, 'tester')).toThrow('Khóa sửa, hủy 5 phút cuối lượt khớp định kỳ (khớp lúc 09:45)')
    simulator.jumpTo(at('09:46'))
    expect(engine.cancelOrder(id, 'tester').status).toMatch(/CANCEL/)
  })

  it('TWAP trên mã hạn chế: không sinh lệnh con lúc nghỉ trưa, sinh lại trong lượt định kỳ buổi chiều', () => {
    const { simulator, engine } = setup()
    simulator.jumpTo(at('11:20'))
    const id = engine.createOrder(
      request({
        strategy_type: 'TWAP',
        total_qty: 4_000,
        limit_price: 13_500,
        parameters: [param('start_time', '11:20'), param('end_time', '14:20'), param('interval_min', 60)],
      }),
      'tester',
    ).parent_order_id
    simulator.advance(5)
    const before = engine.getChildren(id).length
    simulator.jumpTo(at('12:00'))
    simulator.advance(30)
    simulator.jumpTo(at('12:30'))
    simulator.advance(30)
    expect(engine.getChildren(id).length).toBe(before)
    simulator.jumpTo(at('13:05'))
    simulator.advance(5)
    expect(engine.getChildren(id).every((child) => child.order_type === 'LO')).toBe(true)
  })
})

describe('tạm ngừng và giao dịch lại', () => {
  it('tạm ngừng: lệnh cha chuyển PAUSED_SYSTEM (SYMBOL_HALTED), lệnh mới bị từ chối; giao dịch lại: tự chạy, phiên định kỳ 15 phút rồi khớp', () => {
    const { simulator, engine, quote } = setup()
    simulator.jumpTo(at('10:00'))
    simulator.pushTrade('FPT', 118_000, 100)
    const id = engine.createOrder(request({ symbol: 'FPT', limit_price: 117_000 }), 'tester').parent_order_id
    simulator.advance(3)
    expect(engine.getChildren(id)[0].status).toBe('ACKNOWLEDGED')

    simulator.haltSymbol('FPT')
    expect(quote('FPT').phase?.session).toBe('HALTED')
    expect(engine.getOrder(id)).toMatchObject({ status: 'PAUSED_SYSTEM', reason_code: 'SYMBOL_HALTED' })
    expect(engine.getChildren(id)[0].status).toBe('CANCELLED')
    expect(() => engine.createOrder(request({ symbol: 'FPT', limit_price: 117_000 }), 'tester')).toThrow('tạm ngừng giao dịch')
    simulator.advance(60)
    expect(engine.getOrder(id).status).toBe('PAUSED_SYSTEM')

    const resumedAt = simulator.getState().sim_seconds
    simulator.resumeSymbol('FPT')
    expect(quote('FPT')).toMatchObject({ halt: { status: 'REOPEN' }, phase: { session: 'REOPEN', call_end: resumedAt + 15 * 60 } })
    expect(engine.getOrder(id).status).toBe('ACTIVE')
    expect(engine.getEvents(id).some((event) => event.reason_code === 'SYMBOL_RESUMED')).toBe(true)
    simulator.advance(3)
    // Phiên mở lại: lệnh con LO sinh lại nhưng chưa khớp; cấm sửa, hủy; chỉ nhận LO.
    expect(engine.getChildren(id).at(-1)).toMatchObject({ order_type: 'LO', status: 'ACKNOWLEDGED' })
    expect(() => engine.cancelOrder(id, 'tester')).toThrow('Khớp định kỳ sau tạm ngừng')
    expect(() => engine.updateOrder(id, { version: 1, total_qty: 500, limit_price: 117_000 }, 'tester')).toThrow('Khớp định kỳ sau tạm ngừng')
    expect(() =>
      engine.createOrder(request({ symbol: 'FPT', strategy_type: 'STOP', limit_price: null, parameters: [param('trigger_price', 119_000)] }), 't'),
    ).not.toThrow() // lệnh thuật toán (MTL khi kích hoạt) vẫn đặt được, chỉ cảnh báo phiên
    expect(() => engine.createOrder(request({ symbol: 'FPT', total_qty: 50, lot_type: 'ODD', limit_price: 117_000 }), 't')).not.toThrow()

    // Hết phiên định kỳ: khớp một lần tại giá dự kiến (giá khớp 116.900 thấp hơn giá mua 117.000), mã về bình thường.
    simulator.pushTrade('FPT', 116_900, 100)
    simulator.jumpTo(resumedAt + 15 * 60)
    expect(engine.getOrder(id)).toMatchObject({ executed_qty: 1_000, status: 'COMPLETED' })
    expect(quote('FPT').phase).toBeUndefined()
    expect(quote('FPT').halt).toBeUndefined()
  })
})

describe('lệnh thỏa thuận trên engine', () => {
  const deal = (extra: Partial<Parameters<ReturnType<typeof setup>['engine']['createPutThrough']>[0]> = {}) => ({
    account_no: DOMESTIC,
    counterparty_account: '999C000001',
    symbol: 'FPT',
    side: 'BUY' as const,
    qty: 20_000,
    price: 118_050,
    ...extra,
  })

  it('14:50 gửi → đối ứng xác nhận → khớp; không hủy được sau khi khớp; không đổi sổ lệnh, khớp lệnh, băng tick', () => {
    const { simulator, engine, quote } = setup()
    const tape: number[] = []
    simulator.onTrades((trades) => trades.forEach((trade) => tape.push(trade.qty)))
    simulator.jumpTo(at('14:50'))
    expect(simulator.getState().session).toBe('PUT_THROUGH')
    const depthBefore = JSON.stringify(quote('FPT').depth)
    const volumeBefore = quote('FPT').total_volume

    expect(() => engine.createPutThrough(deal({ qty: 10_000 }), 'tester')).toThrow('tối thiểu 20.000 CP')
    expect(() => engine.createPutThrough(deal({ price: 130_000 }), 'tester')).toThrow('vượt giá trần')
    const created = engine.createPutThrough(deal(), 'tester')
    expect(created).toMatchObject({ status: 'PENDING_CONFIRM', deal_id: 'PT-20261116-0001' })

    const matched = engine.confirmPutThrough(created.deal_id, 'DOI_UNG')
    expect(matched).toMatchObject({ status: 'MATCHED', matched_at: '2026-11-16T14:50:00' })
    expect(() => engine.cancelPutThrough(created.deal_id, 'tester')).toThrow('đã khớp: không sửa, không hủy được')
    expect(() => engine.confirmPutThrough(created.deal_id, 'DOI_UNG')).toThrow('không còn chờ xác nhận')

    expect(engine.listExecutions()).toEqual([])
    expect(tape).toEqual([])
    expect(JSON.stringify(quote('FPT').depth)).toBe(depthBefore)
    expect(quote('FPT').total_volume).toBe(volumeBefore)
    expect(engine.listPutThroughEvents().map((event) => [event.action, event.new_value])).toEqual([
      ['CREATE', 'PENDING_CONFIRM'],
      ['FILL', 'MATCHED'],
    ])
    // Nhật ký lệnh cha không có gì của lệnh thỏa thuận.
    expect(engine.listEvents().some((event) => event.parent_order_id.startsWith('PT-'))).toBe(false)
  })

  it('hủy được khi chưa khớp; đối ứng từ chối; chưa khớp thì hết hiệu lực lúc 15:00', () => {
    const { simulator, engine } = setup()
    simulator.jumpTo(at('14:46'))
    const a = engine.createPutThrough(deal(), 'tester')
    const b = engine.createPutThrough(deal(), 'tester')
    const c = engine.createPutThrough(deal(), 'tester')
    expect(engine.cancelPutThrough(a.deal_id, 'tester').status).toBe('CANCELLED')
    expect(engine.rejectPutThrough(b.deal_id, 'DOI_UNG').status).toBe('REJECTED')
    simulator.jumpTo(at('15:00'))
    expect(engine.listPutThroughs().find((item) => item.deal_id === c.deal_id)?.status).toBe('EXPIRED')
    // Ngoài giờ không nhận thỏa thuận.
    expect(() => engine.createPutThrough(deal(), 'tester')).toThrow('không nhận lệnh thỏa thuận')
  })

  it('báo cáo hiệu quả: VWAP thị trường không tính giao dịch thỏa thuận', async () => {
    const { getOrderMarketStats } = await import('./report')
    const { simulator, engine } = setup()
    const tape: Array<{ symbol: string; time: string; price: number; qty: number }> = []
    simulator.onTrades((trades) => tape.push(...trades))
    simulator.jumpTo(at('10:00'))
    simulator.pushTrade('FPT', 118_000, 1_000)
    const order = engine.createOrder(request({ symbol: 'FPT', limit_price: 117_000 }), 'tester')
    simulator.pushTrade('FPT', 118_100, 1_000)
    const listTicks = (symbol: string, from: string, to: string) =>
      tape.filter((trade) => trade.symbol === symbol && trade.time >= from && trade.time <= to)
    const before = getOrderMarketStats(engine.getOrder(order.parent_order_id), engine.getSnapshot(order.parent_order_id) ?? null, '2026-11-16T10:30:00', listTicks)
    const created = engine.createPutThrough(deal({ price: 120_000 }), 'tester')
    engine.confirmPutThrough(created.deal_id, 'DOI_UNG')
    const after = getOrderMarketStats(engine.getOrder(order.parent_order_id), engine.getSnapshot(order.parent_order_id) ?? null, '2026-11-16T10:30:00', listTicks)
    expect(before?.volume).toBeGreaterThan(0)
    expect(after).toEqual(before)
  })
})
