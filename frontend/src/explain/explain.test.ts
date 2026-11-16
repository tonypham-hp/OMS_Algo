import { describe, expect, it } from 'vitest'
import { formatNumber } from '@/lib/format'
import { iso, makeChild, makeEvent, makeExecution, makeOrder, TODAY } from '@/test/fixtures'
import type { ChildOrder, OrderEvent, ParentOrder, Role, StrategyParameter } from '@/types'
import { explainChild, explainOrder } from './explain'
import { REASONS } from './reasons'
import type { ExplainCode, ExplainContext, ExplainExtra, ExplainMarket, Explanation } from './types'

const MARKET: ExplainMarket = {
  session: 'CONTINUOUS',
  quote: { ref_price: 128_500, last_price: 129_000, bid_price: 128_900, ask_price: 129_000 },
  quote_age_seconds: 0,
  max_delay_seconds: 5,
  max_rejects: 2,
}

const param = (code: string, value: string): StrategyParameter => ({ parameter_code: code, parameter_value: value, data_type: 'INTEGER' })

/** Mọi "token số" trong một chuỗi: 128.500, 12,5, 7, 09:15:00 → 09, 15, 00. */
const NUMBER_TOKEN = /\d+(?:[.,]\d+)*/g
const tokensOf = (text: string) => text.match(NUMBER_TOKEN) ?? []

/** Tập token số lấy từ mọi giá trị trong ctx (số đã định dạng kiểu Việt Nam, và các chuỗi như mã lệnh, giờ). */
function contextTokens(value: unknown, into = new Set<string>()): Set<string> {
  if (typeof value === 'number') {
    into.add(formatNumber(value))
    into.add(String(value))
  } else if (typeof value === 'string') {
    for (const token of tokensOf(value)) into.add(token)
  } else if (Array.isArray(value)) {
    for (const item of value) contextTokens(item, into)
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) contextTokens(item, into)
  }
  return into
}

/** Câu giải thích không có số nào nằm ngoài dữ liệu đầu vào. */
function expectNumbersFromContext(explanation: Explanation) {
  const allowed = contextTokens(explanation.context)
  for (const token of tokensOf(explanation.text)) {
    expect(allowed, `số "${token}" trong câu không có trong ctx: ${explanation.text}`).toContain(token)
  }
}

function explain(
  order: ParentOrder,
  options: { children?: ChildOrder[]; events?: OrderEvent[]; market?: Partial<ExplainMarket>; role?: Role; extra?: ExplainExtra } = {},
) {
  const result = explainOrder(
    order,
    options.children ?? [],
    options.events ?? [],
    { ...MARKET, ...options.market },
    options.role ?? 'CUSTOMER',
    options.extra,
  )
  expectNumbersFromContext(result)
  return result
}

const ev = (overrides: Partial<OrderEvent> & Pick<OrderEvent, 'action'>) => makeEvent({ parent_order_id: 'PO-1', ...overrides })

describe('explainOrder theo từng mã lý do', () => {
  it('PRICE_OUT_OF_BAND: FPT tham chiếu 128.500, giá 138.000 → trần 137.400, gợi ý sửa về 137.400', () => {
    const order = makeOrder('PO-1', { status: 'PAUSED_SYSTEM', reason_code: 'PRICE_OUT_OF_BAND', limit_price: 138_000 })
    const result = explain(order, { role: 'CUSTOMER' })
    expect(result.code).toBe('PRICE_OUT_OF_BAND')
    expect(result.title).toBe('Vì sao lệnh này đang dừng?')
    for (const text of ['128.500', '138.000', '137.400', '±7%', 'bước giá 100']) expect(result.text).toContain(text)
    const reprice = result.actions.find((action) => action.kind === 'REPRICE')
    expect(reprice?.label).toBe('Sửa giá')
    expect(reprice?.enabled).toBe(true)
    expect(reprice?.prices).toEqual({ limit_price: 137_400 })
    expect(result.sources.join(' ')).toContain('Giá tham chiếu')
  })

  it('PRICE_OUT_OF_BAND dưới sàn: gợi ý giá sàn đã làm tròn lên', () => {
    // 128.500 × 0,93 = 119.505 → làm tròn lên bước 100 = 119.600.
    const order = makeOrder('PO-1', { status: 'PAUSED_SYSTEM', reason_code: 'PRICE_OUT_OF_BAND', limit_price: 110_000 })
    const result = explain(order)
    expect(result.text).toContain('thấp hơn giá sàn 119.600')
    expect(result.actions.find((action) => action.kind === 'REPRICE')?.prices).toEqual({ limit_price: 119_600 })
  })

  it('PRICE_OUT_OF_BAND đọc giá từ bản ghi DECISION của engine (giá kích hoạt)', () => {
    const order = makeOrder('PO-1', { status: 'PAUSED_SYSTEM', reason_code: 'PRICE_OUT_OF_BAND', strategy_type: 'STOP_LIMIT', limit_price: 130_000 })
    const events = [
      ev({ action: 'DECISION', old_value: 'trigger_price=140000', new_value: 'PRICE_OUT_OF_BAND:floor=119600,ceiling=137400', reason_code: 'PRICE_OUT_OF_BAND' }),
    ]
    const result = explain(order, { events })
    expect(result.text).toContain('giá kích hoạt 140.000')
    expect(result.actions.find((action) => action.kind === 'REPRICE')?.prices).toEqual({ trigger_price: 137_400 })
    expect(result.actions.find((action) => action.kind === 'SCROLL_LOG')?.event_id).toBe(events[0].event_id)
  })

  it('PRICE_OUT_OF_BAND trong ATO: nút Sửa giá bị khóa kèm lý do', () => {
    const order = makeOrder('PO-1', { status: 'PAUSED_SYSTEM', reason_code: 'PRICE_OUT_OF_BAND', limit_price: 138_000 })
    const reprice = explain(order, { market: { session: 'ATO' } }).actions.find((action) => action.kind === 'REPRICE')
    expect(reprice?.enabled).toBe(false)
    expect(reprice?.reason).toContain('Phiên ATO')
  })

  it('SESSION_LOCKED: lệnh đang chạy trong ATC', () => {
    const order = makeOrder('PO-1', { executed_qty: 300 })
    const result = explain(order, { market: { session: 'ATC' } })
    expect(result.code).toBe('SESSION_LOCKED')
    expect(result.title).toBe('Vì sao chưa sửa, hủy được lệnh này?')
    expect(result.text).toContain('Phiên ATC')
    expect(result.text).toContain('300/1.000 CP')
  })

  it('STALE_MARKET_DATA: giá trễ 8 giây, ngưỡng 5 giây', () => {
    const order = makeOrder('PO-1', { status: 'PAUSED_SYSTEM', reason_code: 'MARKET_DATA_STALE' })
    const result = explain(order, { market: { quote_age_seconds: 8.4 } })
    expect(result.code).toBe('STALE_MARKET_DATA')
    expect(result.text).toContain('ngưỡng 5 giây')
    expect(result.text).toContain('trễ 8 giây')
  })

  it('STALE_MARKET_DATA với khách hàng: không biết ngưỡng thì không ghi số', () => {
    const order = makeOrder('PO-1', { status: 'PAUSED_SYSTEM', reason_code: 'MARKET_DATA_STALE' })
    const result = explain(order, { market: { max_delay_seconds: null, quote_age_seconds: 6 } })
    expect(result.text).toContain('ngưỡng do vận hành cấu hình')
    expect(result.actions.map((action) => action.kind)).not.toContain('OPEN_OPS')
  })

  it('KILL_SWITCH: nêu phạm vi tài khoản và giờ kích hoạt', () => {
    const order = makeOrder('PO-1', { status: 'PAUSED_SYSTEM', reason_code: 'KILL_SWITCH' })
    const events = [ev({ action: 'DECISION', new_value: 'KILL_SWITCH:ACCOUNT:A', reason_code: 'KILL_SWITCH', event_time: iso(TODAY, '10:05:00'), user_id: 'ops01' })]
    const result = explain(order, { events, role: 'OPS' })
    expect(result.code).toBe('KILL_SWITCH')
    expect(result.text).toContain('cho tài khoản A lúc 10/11 10:05:00')
    expect(result.actions.map((action) => action.kind)).toContain('OPEN_OPS')
  })

  it('CHILD_REJECTED: Core từ chối 2 lần liên tiếp vì sai lô 100', () => {
    const order = makeOrder('PO-1', { status: 'PAUSED_SYSTEM', reason_code: 'CHILD_REJECTED_REPEAT' })
    const first = { ...makeChild('CH1', 'PO-1', 'REJECTED'), cycle_no: 1, quantity: 550 }
    const second = { ...makeChild('CH2', 'PO-1', 'REJECTED'), cycle_no: 2, quantity: 550 }
    const events = [
      ev({ action: 'REJECT', child_order_id: 'CH1', reason_code: 'CORE_REJECT', reject_code: 'LOT_SIZE' }),
      ev({ action: 'REJECT', child_order_id: 'CH2', reason_code: 'CORE_REJECT', reject_code: 'LOT_SIZE' }),
    ]
    const result = explain(order, { children: [first, second], events, role: 'OPS' })
    expect(result.code).toBe('CHILD_REJECTED')
    expect(result.text).toContain('Core từ chối 2 lệnh con liên tiếp (ngưỡng 2 lần)')
    expect(result.text).toContain('khối lượng 550 CP không phải bội số của lô 100')
    expect(result.actions.find((action) => action.kind === 'SCROLL_LOG')?.event_id).toBe(events[1].event_id)
  })

  it('CHILD_REJECTED khi lệnh còn chạy: vượt 500.000 CP/lệnh', () => {
    const order = makeOrder('PO-1')
    const child = { ...makeChild('CH1', 'PO-1', 'REJECTED'), quantity: 600_000 }
    const events = [ev({ action: 'REJECT', child_order_id: 'CH1', reason_code: 'CORE_REJECT', reject_code: 'MAX_QTY' })]
    const result = explain(order, { children: [child], events })
    expect(result.code).toBe('CHILD_REJECTED')
    expect(result.text).toContain('600.000 CP vượt mức tối đa 500.000 CP/lệnh')
    expect(result.text).toContain('2 lần liên tiếp')
  })

  it('CHILD_REJECTED sai bước giá: nêu bước giá của mức giá đó', () => {
    const order = makeOrder('PO-1')
    const child = { ...makeChild('CH1', 'PO-1', 'REJECTED'), price: 27_520 }
    const events = [ev({ action: 'REJECT', child_order_id: 'CH1', reason_code: 'CORE_REJECT', reject_code: 'TICK_SIZE' })]
    expect(explain(order, { children: [child], events }).text).toContain('giá 27.520 không đúng bước giá 50 đ')
  })

  it('CHILD_UNKNOWN: mất ACK, đang đối soát, chưa gửi lại', () => {
    const order = makeOrder('PO-1', { executed_qty: 1_000, total_qty: 6_000 })
    const child = { ...makeChild('CH2', 'PO-1', 'UNKNOWN'), cycle_no: 2, quantity: 1_000 }
    const events = [ev({ action: 'CHILD_UNKNOWN', child_order_id: 'CH2', new_value: 'UNKNOWN', reason_code: 'ACK_TIMEOUT' })]
    const result = explain(order, { children: [child], events, role: 'OPS' })
    expect(result.code).toBe('CHILD_UNKNOWN')
    expect(result.text).toContain('chu kỳ 2 (1.000 CP)')
    expect(result.text).toContain('chưa gửi lại')
    const reconcile = result.actions.find((action) => action.kind === 'RECONCILE')
    expect(reconcile?.child_order_id).toBe('CH2')
  })

  it('CHILD_UNKNOWN ở lệnh hệ thống dừng chưa có reason_code (dữ liệu mẫu cũ)', () => {
    const order = makeOrder('PO-1', { status: 'PAUSED_SYSTEM', reason_code: null })
    const child = makeChild('CH1', 'PO-1', 'UNKNOWN')
    expect(explain(order, { children: [child] }).code).toBe('CHILD_UNKNOWN')
  })

  it('CONDITION_WAITING: Stop mua 131.000, giá 129.000 → còn cách 2.000 đ, 20 bước giá', () => {
    const order = makeOrder('PO-1', { strategy_type: 'STOP' , limit_price: null })
    const result = explain(order, { extra: { parameters: [param('trigger_price', '131000')] } })
    expect(result.code).toBe('CONDITION_WAITING')
    expect(result.text).toContain('giá kích hoạt 131.000')
    expect(result.text).toContain('tăng lên thêm 2.000 đ (20 bước giá)')
    expect(result.text).toContain('129.000')
  })

  it('CONDITION_WAITING: Trailing Stop không có giá kích hoạt cố định → chưa đủ dữ liệu', () => {
    const order = makeOrder('PO-1', { strategy_type: 'TRAILING_STOP', side: 'SELL', limit_price: null })
    const result = explain(order, { extra: { parameters: [param('trailing_value', '1500')] } })
    expect(result.text).toContain('1.500 đ')
    expect(result.text).toContain('chưa đủ dữ liệu')
  })

  it('POV_THROTTLED: đã chạm % tham gia tối đa', () => {
    const order = makeOrder('PO-1', { strategy_type: 'POV', executed_qty: 500 })
    const events = [ev({ action: 'DECISION', old_value: 'WANTED:800', new_value: 'POV_CAP:max_pct=20,cap=300,market=1500', reason_code: 'POV_THROTTLED' })]
    const result = explain(order, { events, extra: { parameters: [param('participation_pct', '10'), param('max_pct', '20')] } })
    expect(result.code).toBe('POV_THROTTLED')
    expect(result.text).toContain('tối đa 20%')
    expect(result.text).toContain('1.500 CP')
    expect(result.text).toContain('tối đa 300 CP (mục tiêu 10%)')
  })

  it('POV hết bị chặn khi đã sinh lệnh con sau đó', () => {
    const order = makeOrder('PO-1', { strategy_type: 'POV' })
    const events = [
      ev({ action: 'DECISION', new_value: 'POV_CAP:max_pct=20,cap=300,market=1500', reason_code: 'POV_THROTTLED' }),
      ev({ action: 'CHILD_CREATE', child_order_id: 'CH9', new_value: 'CREATED' }),
    ]
    expect(explain(order, { events }).code).toBe('RUNNING')
  })

  it('HUNT_NO_LEVEL đang chờ: chưa có mức trong giới hạn giá', () => {
    const order = makeOrder('PO-1', { strategy_type: 'HUNT', limit_price: 128_000 })
    const events = [
      ev({ action: 'TRIGGER', new_value: 'TRIGGERED' }),
      ev({ action: 'DECISION', old_value: 'BEST:128500', new_value: 'HUNT_WAITING_LEVEL:limit=128000', reason_code: 'HUNT_WAITING_LEVEL' }),
    ]
    const result = explain(order, { events, extra: { parameters: [param('max_wait_min', '30')] } })
    expect(result.code).toBe('HUNT_NO_LEVEL')
    expect(result.text).toContain('giới hạn giá 128.000')
    expect(result.text).toContain('128.500')
    expect(result.text).toContain('30 phút')
  })

  it('HUNT_NO_LEVEL đã hết hạn: hủy phần còn lại', () => {
    const order = makeOrder('PO-1', { strategy_type: 'HUNT', status: 'EXPIRED', executed_qty: 700, limit_price: 129_000 })
    const events = [ev({ action: 'DECISION', new_value: 'EXPIRED', reason_code: 'HUNT_NO_LEVEL' })]
    const result = explain(order, { events })
    expect(result.code).toBe('HUNT_NO_LEVEL')
    expect(result.text).toContain('700/1.000 CP')
    expect(result.text).toContain('Phần còn lại 300 CP')
  })

  it('PAUSED_USER: nêu người và giờ tạm dừng, có nút Tiếp tục', () => {
    const order = makeOrder('PO-1', { status: 'PAUSED_USER', executed_qty: 200 })
    const events = [ev({ action: 'PAUSE', new_value: 'PAUSED_USER', user_id: 'kh01', reason_code: 'USER_PAUSE', event_time: iso(TODAY, '10:00:00') })]
    const result = explain(order, { events })
    expect(result.code).toBe('PAUSED_USER')
    expect(result.text).toContain('kh01 lúc 10/11 10:00:00')
    expect(result.actions.find((action) => action.kind === 'RESUME')?.label).toBe('Tiếp tục')
  })

  it('EXPIRED: lệnh DAY hết ngày', () => {
    const order = makeOrder('PO-1', { status: 'EXPIRED', executed_qty: 400 })
    const events = [ev({ action: 'DECISION', new_value: 'EXPIRED', reason_code: 'DAY_END', event_time: iso(TODAY, '15:00:00') })]
    const result = explain(order, { events })
    expect(result.code).toBe('EXPIRED')
    expect(result.text).toContain('chỉ có hiệu lực trong ngày')
    expect(result.text).toContain('Phần còn lại 600 CP')
  })

  it('EXPIRED: GTD tới ngày hết hiệu lực', () => {
    const order = makeOrder('PO-1', { status: 'EXPIRED', persistence_mode: 'GTD', valid_to: '2026-11-12' })
    const events = [ev({ action: 'DECISION', new_value: 'EXPIRED', reason_code: 'VALID_TO_REACHED' })]
    expect(explain(order, { events }).text).toContain('12/11/2026')
  })

  it('EXPIRED không rõ nguyên nhân → chưa đủ dữ liệu', () => {
    const order = makeOrder('PO-1', { status: 'EXPIRED' })
    expect(explain(order).text).toContain('chưa đủ dữ liệu')
  })

  it('COMPLETED: giá bình quân và hiệu quả so arrival', () => {
    // Mua 1.000 CP giá bình quân 128.800, arrival 129.000 → tốt hơn 15,5 bps.
    const order = makeOrder('PO-1', { status: 'COMPLETED', executed_qty: 1_000 })
    const child = { ...makeChild('CH1', 'PO-1', 'FILLED'), quantity: 1_000, filled_qty: 1_000 }
    const executions = [makeExecution('X1', 'CH1', 'PO-1', 600, 128_700), makeExecution('X2', 'CH1', 'PO-1', 400, 128_950)]
    const snapshot = { arrival_price: 129_000, arrival_bid: 128_900, arrival_ask: 129_000, arrival_timestamp: iso(TODAY, '09:15:00') }
    const result = explain(order, { children: [child], extra: { executions, snapshot } })
    expect(result.code).toBe('COMPLETED')
    expect(result.text).toContain('giá bình quân 128.800')
    expect(result.text).toContain('arrival 129.000')
    expect(result.text).toContain('tốt hơn (+15,5 bps)')
  })

  it('COMPLETED thiếu arrival → chưa đủ dữ liệu để so sánh', () => {
    const order = makeOrder('PO-1', { status: 'COMPLETED', executed_qty: 1_000 })
    expect(explain(order).text).toContain('Chưa đủ dữ liệu để so với giá arrival')
  })

  it('CANCELLED: người hủy và phần còn lại', () => {
    const order = makeOrder('PO-1', { status: 'CANCELLED', executed_qty: 100 })
    const events = [ev({ action: 'CANCEL', new_value: 'CANCELLED', user_id: 'dl01', reason_code: 'USER_CANCEL' })]
    const result = explain(order, { events })
    expect(result.code).toBe('CANCELLED')
    expect(result.text).toContain('dl01')
    expect(result.text).toContain('900 CP')
  })
})

describe('thiếu dữ kiện', () => {
  it('không có bảng giá: không ném lỗi, nói chưa đủ dữ liệu', () => {
    const order = makeOrder('PO-1', { status: 'PAUSED_SYSTEM', reason_code: 'PRICE_OUT_OF_BAND', limit_price: 138_000 })
    const result = explain(order, { market: { quote: null } })
    expect(result.text).toContain('chưa đủ dữ liệu')
    expect(result.actions.find((action) => action.kind === 'REPRICE')?.prices).toBeUndefined()
  })

  it('lệnh hệ thống dừng không có lý do nào → chưa đủ dữ liệu', () => {
    const order = makeOrder('PO-1', { status: 'PAUSED_SYSTEM' })
    const result = explain(order, { market: { quote: null, quote_age_seconds: null, max_delay_seconds: null } })
    expect(result.code).toBe('NOT_ENOUGH_DATA')
    expect(result.text).toContain('Chưa đủ dữ liệu')
  })

  it('mọi mã trong danh mục đều sinh được câu từ ctx gần như rỗng mà không ném lỗi', () => {
    const order = makeOrder('PO-1')
    const ctx = explainOrder(order, [], [], { ...MARKET, quote: null }, 'CUSTOMER').context
    for (const code of Object.keys(REASONS) as ExplainCode[]) {
      const empty: ExplainContext = { ...ctx, pov: null, hunt: null, conditions: [], last_reject: null, unknown_child: null }
      expect(() => REASONS[code].template(empty)).not.toThrow()
      expect(REASONS[code].title.length).toBeGreaterThan(0)
    }
  })
})

describe('hành động theo vai trò', () => {
  const pausedRejected = makeOrder('PO-1', { status: 'PAUSED_SYSTEM', reason_code: 'CHILD_REJECTED_REPEAT' })
  const OPS_KINDS = ['REOPEN', 'RECONCILE', 'OPEN_OPS']

  it('"Mở lại" chỉ vận hành thấy', () => {
    expect(explain(pausedRejected, { role: 'OPS' }).actions.map((action) => action.label)).toContain('Mở lại')
    expect(explain(pausedRejected, { role: 'DEALER' }).actions.map((action) => action.label)).not.toContain('Mở lại')
    expect(explain(pausedRejected, { role: 'CUSTOMER' }).actions.map((action) => action.label)).not.toContain('Mở lại')
  })

  it('khách hàng không thấy hành động vận hành ở mọi trường hợp', () => {
    const orders = [
      pausedRejected,
      makeOrder('PO-1', { status: 'PAUSED_SYSTEM', reason_code: 'KILL_SWITCH' }),
      makeOrder('PO-1', { status: 'PAUSED_SYSTEM', reason_code: 'MARKET_DATA_STALE' }),
      makeOrder('PO-1', { status: 'PAUSED_SYSTEM' }),
    ]
    const unknown = makeChild('CH1', 'PO-1', 'UNKNOWN')
    for (const order of orders) {
      const kinds = explain(order, { role: 'CUSTOMER', children: [unknown] }).actions.map((action) => action.kind)
      for (const kind of OPS_KINDS) expect(kinds).not.toContain(kind)
    }
  })

  it('lệnh đang chạy không có nút "Mở lại" kể cả với vận hành', () => {
    const order = makeOrder('PO-1')
    const child = makeChild('CH1', 'PO-1', 'REJECTED')
    expect(explain(order, { children: [child], role: 'OPS' }).actions.map((action) => action.kind)).not.toContain('REOPEN')
  })
})

describe('explainChild', () => {
  it('lệnh con bị từ chối vì sai bước giá', () => {
    const child = { ...makeChild('CH1', 'PO-1', 'REJECTED'), price: 49_960, cycle_no: 3 }
    const events = [ev({ action: 'REJECT', child_order_id: 'CH1', reject_code: 'TICK_SIZE', reason_code: 'CORE_REJECT' })]
    const result = explainChild(child, events)
    expect(result.code).toBe('CHILD_REJECTED')
    expect(result.text).toBe('Lệnh con chu kỳ 3 bị Core từ chối: giá 49.960 không đúng bước giá 50 đ.')
  })

  it('lệnh con UNKNOWN, đối soát hủy và giữ', () => {
    expect(explainChild(makeChild('CH1', 'PO-1', 'UNKNOWN'), []).text).toContain('mất xác nhận (ACK)')
    const cancelled = makeChild('CH2', 'PO-1', 'CANCELLED')
    expect(explainChild(cancelled, [ev({ action: 'RECOVERY', child_order_id: 'CH2', reason_code: 'RECONCILED_CANCELLED' })]).text).toContain('đối soát xong')
    const kept = makeChild('CH3', 'PO-1', 'ACKNOWLEDGED')
    expect(explainChild(kept, [ev({ action: 'RECOVERY', child_order_id: 'CH3', reason_code: 'RECONCILED_KEPT' })]).text).toContain('không gửi lại')
  })

  it('lệnh con khớp một phần', () => {
    const child = { ...makeChild('CH1', 'PO-1', 'PARTIAL_FILLED'), filled_qty: 200 }
    expect(explainChild(child, []).text).toBe('Lệnh con chu kỳ 1 đã khớp 200/500 CP ở giá 100.000, đang chờ khớp 300 CP còn lại.')
  })
})
