import { describe, expect, it } from 'vitest'
import { SYSTEM_PARAM_DEFAULTS } from '@/config/systemParams'
import { createDemoEnv } from '@/demo/env'
import { createRunner } from '@/demo/runner'
import { SCENARIOS } from '@/demo/scenarios'
import { createOrderEngine } from '@/mocks/engine'
import { reconInputFromEngine } from '@/mocks/reconSource'
import { createSeedData } from '@/mocks/seedOrders'
import { createMarketSimulator } from '@/mocks/simulator'
import { formatClock } from '@/lib/format'
import type { ChildOrder, CoreLedgerEntry, Execution, MarketState, OrderEvent, ParentOrder, ReconType, SymbolQuote } from '@/types'
import { getSessionAt } from './hose'
import { getReconSummary, reconcile, validateReconStep, type ReconInput } from './reconcile'

const DAY = '2026-11-16'
const NOW = `${DAY}T10:00:00`
const ALL_DAYS = { from: '2000-01-01', to: '2100-12-31' }

const parent = (overrides: Partial<ParentOrder> = {}): ParentOrder => ({
  parent_order_id: 'P1',
  client_request_id: 'r',
  account_no: '058C123456',
  symbol: 'FPT',
  side: 'BUY',
  total_qty: 2_000,
  executed_qty: 1_000,
  limit_price: 100_000,
  strategy_type: 'ICEBERG',
  status: 'PARTIALLY_EXECUTED',
  reason_code: null,
  valid_from: `${DAY}T09:15:00`,
  valid_to: DAY,
  persistence_mode: 'DAY',
  version: 1,
  created_at: `${DAY}T09:15:00`,
  updated_at: `${DAY}T09:30:00`,
  ...overrides,
})

const child = (overrides: Partial<ChildOrder> = {}): ChildOrder => ({
  child_order_id: 'C1',
  parent_order_id: 'P1',
  cycle_no: 1,
  side: 'BUY',
  order_type: 'LO',
  price: 100_000,
  quantity: 1_000,
  filled_qty: 1_000,
  status: 'FILLED',
  client_order_id: 'cl',
  idempotency_key: 'idem',
  core_order_id: 'CORE-1',
  created_at: `${DAY}T09:20:00`,
  sent_at: `${DAY}T09:20:00`,
  ...overrides,
})

const execution = (overrides: Partial<Execution> = {}): Execution => ({
  execution_id: 'X-M1',
  child_order_id: 'C1',
  parent_order_id: 'P1',
  exchange_match_id: 'M1',
  price: 100_000,
  qty: 1_000,
  match_time: `${DAY}T09:21:00`,
  ...overrides,
})

const ledger = (overrides: Partial<CoreLedgerEntry> = {}): CoreLedgerEntry => ({
  child_order_id: 'C1',
  parent_order_id: 'P1',
  core_order_id: 'CORE-1',
  status: 'FILLED',
  filled_qty: 1_000,
  updated_at: `${DAY}T09:21:00`,
  ...overrides,
})

let eventSeq = 0
const event = (overrides: Partial<OrderEvent>): OrderEvent => {
  eventSeq += 1
  return {
    event_id: `E-${eventSeq}`,
    parent_order_id: 'P1',
    child_order_id: 'C1',
    action: 'DECISION',
    user_id: 'SYSTEM',
    channel: 'ENGINE',
    old_value: null,
    new_value: null,
    event_time: `${DAY}T09:30:00`,
    ...overrides,
  }
}

/** Một lệnh cha, một lệnh con đã khớp đủ 1.000 CP, Core ghi y như OMS. */
function matchedInput(overrides: Partial<ReconInput> = {}): ReconInput {
  return {
    ...ALL_DAYS,
    now: NOW,
    orders: [parent()],
    children: [child()],
    executions: [execution()],
    events: [],
    coreLedger: [ledger()],
    ...overrides,
  }
}

const typesOf = (input: ReconInput) => reconcile(input).rows.map((item) => item.type)

describe('reconcile: từng loại chênh lệch', () => {
  it('dữ liệu khớp hoàn toàn: 0 chênh lệch, mọi lệnh con đã so đều khớp đúng', () => {
    const result = reconcile(matchedInput())
    expect(result.rows).toEqual([])
    expect(result.checked_children).toBe(1)
    expect(result.matched_children).toBe(1)
  })

  it('STATUS_MISMATCH: OMS hết hạn, Core ghi đã hủy', () => {
    const input = matchedInput({
      children: [child({ status: 'EXPIRED', filled_qty: 0 })],
      coreLedger: [ledger({ status: 'CANCELLED', filled_qty: 0 })],
      orders: [parent({ executed_qty: 0 })],
      executions: [],
    })
    const [item] = reconcile(input).rows
    expect(item).toMatchObject({ type: 'STATUS_MISMATCH', oms_value: 'Hết hạn', core_value: 'Đã hủy', status: 'OPEN', child_order_id: 'C1' })
    expect(reconcile(input).matched_children).toBe(0)
  })

  it('STATUS_MISMATCH: OMS có lệnh trên sàn nhưng Core không có', () => {
    expect(typesOf(matchedInput({ coreLedger: [] }))).toEqual(['STATUS_MISMATCH'])
    expect(reconcile(matchedInput({ coreLedger: [] })).rows[0].core_value).toBe('Không có lệnh')
  })

  it('lệnh con đang chờ hủy mà Core còn giữ là bình thường', () => {
    const input = matchedInput({
      children: [child({ status: 'CANCEL_PENDING', filled_qty: 0 })],
      coreLedger: [ledger({ status: 'ACKNOWLEDGED', filled_qty: 0 })],
      orders: [parent({ executed_qty: 0 })],
      executions: [],
    })
    expect(reconcile(input).rows).toEqual([])
  })

  it('QTY_MISMATCH: OMS khớp 1.000, Core ghi 1.200', () => {
    const [item] = reconcile(matchedInput({ coreLedger: [ledger({ filled_qty: 1_200 })] })).rows
    expect(item).toMatchObject({ type: 'QTY_MISMATCH', oms_value: 'Khớp 1.000 CP', core_value: 'Khớp 1.200 CP' })
  })

  it('UNKNOWN_OPEN: UNKNOWN quá ngưỡng; chưa quá ngưỡng thì chưa là chênh lệch, cũng chưa khớp đúng', () => {
    const unknown = child({ status: 'UNKNOWN', filled_qty: 0, core_order_id: null })
    const base = { children: [unknown], coreLedger: [], orders: [parent({ executed_qty: 0 })], executions: [] }
    const old = matchedInput({ ...base, events: [event({ action: 'CHILD_UNKNOWN', old_value: 'SENDING', new_value: 'UNKNOWN', event_time: `${DAY}T09:59:50` })] })
    const [item] = reconcile(old).rows
    expect(item).toMatchObject({ type: 'UNKNOWN_OPEN', status: 'OPEN', core_value: 'Chưa đối soát', detected_at: `${DAY}T09:59:52` })

    const fresh = matchedInput({ ...base, events: [event({ action: 'CHILD_UNKNOWN', old_value: 'SENDING', new_value: 'UNKNOWN', event_time: `${DAY}T09:59:59` })] })
    expect(reconcile(fresh).rows).toEqual([])
    expect(reconcile(fresh).matched_children).toBe(0)
  })

  it('UNKNOWN_RESOLVED: ghi kết quả Core có lệnh / Core không có lệnh, tự ở trạng thái Đã xử lý', () => {
    const history = (kept: boolean) => [
      event({ action: 'CHILD_UNKNOWN', old_value: 'SENDING', new_value: 'UNKNOWN', event_time: `${DAY}T09:20:03` }),
      event({ action: 'RECOVERY', old_value: 'UNKNOWN', new_value: kept ? 'ACKNOWLEDGED' : 'CANCELLED', event_time: `${DAY}T09:20:08`, reason_code: kept ? 'RECONCILED_KEPT' : 'RECONCILED_CANCELLED' }),
    ]
    const kept = reconcile(matchedInput({ events: history(true) })).rows
    expect(kept).toEqual([expect.objectContaining({ type: 'UNKNOWN_RESOLVED', core_value: 'Core có lệnh', status: 'RESOLVED', note: 'Đối soát xong: Core có lệnh.' })])

    const dropped = reconcile(
      matchedInput({
        events: history(false),
        children: [child({ status: 'CANCELLED', filled_qty: 0, core_order_id: null })],
        coreLedger: [],
        orders: [parent({ executed_qty: 0 })],
        executions: [],
      }),
    ).rows
    expect(dropped).toEqual([expect.objectContaining({ type: 'UNKNOWN_RESOLVED', core_value: 'Core không có lệnh', oms_value: 'UNKNOWN → Đã hủy' })])
  })

  it('DUP_FILL_IGNORED: mỗi báo khớp trùng bị bỏ qua là một dòng đã xử lý, KL khớp chỉ ghi một lần', () => {
    const rows = reconcile(matchedInput({ events: [event({ old_value: 'DUPLICATE_FILL:M1', new_value: 'IGNORED' })] })).rows
    expect(rows).toEqual([expect.objectContaining({ type: 'DUP_FILL_IGNORED', oms_value: 'Ghi 1 lần khớp M1', status: 'RESOLVED' })])
  })

  it('PARENT_SUM_MISMATCH: executed_qty của lệnh cha khác tổng Execution', () => {
    const [item] = reconcile(matchedInput({ orders: [parent({ executed_qty: 1_500 })] })).rows
    expect(item).toMatchObject({ type: 'PARENT_SUM_MISMATCH', child_order_id: null, oms_value: 'executed_qty 1.500 CP', core_value: 'Tổng khớp 1.000 CP' })
  })

  it('OVERFILL: tổng khớp vượt total_qty, là lỗi nghiêm trọng và đứng đầu danh sách', () => {
    const input = matchedInput({ orders: [parent({ total_qty: 800, executed_qty: 1_000 })] })
    const rows = reconcile(input).rows
    expect(rows[0]).toMatchObject({ type: 'OVERFILL', critical: true, status: 'OPEN' })
    expect(getReconSummary(reconcile(input)).critical).toBe(1)
  })

  it('chỉ so lệnh con tạo trong khoảng ngày (cộng lệnh con chưa kết thúc)', () => {
    const old = child({ child_order_id: 'C0', created_at: '2026-11-10T10:00:00', sent_at: '2026-11-10T10:00:00' })
    const live = child({ child_order_id: 'C2', status: 'ACKNOWLEDGED', filled_qty: 0, created_at: '2026-11-10T10:00:00' })
    const input = matchedInput({
      from: DAY,
      to: DAY,
      children: [child(), old, live],
      coreLedger: [ledger(), ledger({ child_order_id: 'C2', status: 'ACKNOWLEDGED', filled_qty: 0 })],
    })
    // C0 là lệnh con đã khớp từ trước khoảng: không so, cũng không làm lệch tổng lệnh cha.
    const result = reconcile({ ...input, orders: [parent({ executed_qty: 2_000 })], executions: [execution(), execution({ execution_id: 'X-M0', child_order_id: 'C0', exchange_match_id: 'M0' })] })
    expect(result.checked_children).toBe(2)
    expect(result.rows).toEqual([])
  })
})

describe('reconcile: đánh dấu đã xử lý (maker-checker)', () => {
  const mismatch = matchedInput({ coreLedger: [ledger({ filled_qty: 1_200 })] })
  const id = reconcile(mismatch).rows[0].id
  const decision = (newValue: string, userId: string, reason?: string) =>
    event({ old_value: `RECON:${id}`, new_value: newValue, user_id: userId, channel: 'WEB', reason })

  it('Mở → Chờ duyệt → Đã xử lý; bị từ chối thì về Mở kèm lý do', () => {
    const requested = reconcile({ ...mismatch, events: [decision('RESOLVE_REQUESTED', 'vanhanh', 'Core xác nhận 1.200')] }).rows[0]
    expect(requested).toMatchObject({ status: 'PENDING_APPROVAL', note: 'Core xác nhận 1.200', requested_by: 'vanhanh' })

    const approved = reconcile({ ...mismatch, events: [decision('RESOLVE_REQUESTED', 'vanhanh', 'Core xác nhận 1.200'), decision('RESOLVED', 'vanhanh2')] })
    expect(approved.rows[0]).toMatchObject({ status: 'RESOLVED', approved_by: 'vanhanh2' })
    expect(getReconSummary(approved)).toMatchObject({ open: 0, resolved: 1 })

    const rejected = reconcile({ ...mismatch, events: [decision('RESOLVE_REQUESTED', 'vanhanh', 'x'), decision('RESOLVE_REJECTED', 'vanhanh2', 'Chưa đủ chứng từ')] }).rows[0]
    expect(rejected).toMatchObject({ status: 'OPEN', note: 'Bị từ chối bởi vanhanh2: Chưa đủ chứng từ', requested_by: null })
  })

  it('validateReconStep: bắt buộc ghi chú, người đánh dấu không tự duyệt, dòng tự xử lý không đánh dấu được', () => {
    const open = reconcile(mismatch).rows[0]
    expect(validateReconStep(open, 'RESOLVE_REQUESTED', 'vanhanh', '   ')).toBe('Phải nhập ghi chú khi đánh dấu đã xử lý')
    expect(validateReconStep(open, 'RESOLVE_REQUESTED', 'vanhanh', 'ok')).toBeNull()
    expect(validateReconStep(open, 'RESOLVED', 'vanhanh2', '')).toBe('Dòng này không chờ duyệt')

    const pending = reconcile({ ...mismatch, events: [decision('RESOLVE_REQUESTED', 'vanhanh', 'ok')] }).rows[0]
    expect(validateReconStep(pending, 'RESOLVED', 'vanhanh', '')).toContain('không được tự duyệt')
    expect(validateReconStep(pending, 'RESOLVED', 'vanhanh2', '')).toBeNull()
    expect(validateReconStep(pending, 'RESOLVE_REJECTED', 'vanhanh2', '')).toBe('Phải nhập lý do từ chối')

    const dup = reconcile(matchedInput({ events: [event({ old_value: 'DUPLICATE_FILL:M1', new_value: 'IGNORED' })] })).rows[0]
    expect(validateReconStep(dup, 'RESOLVE_REQUESTED', 'vanhanh', 'ok')).toBe('Dòng này hệ thống đã tự xử lý')
    expect(validateReconStep(undefined, 'RESOLVE_REQUESTED', 'vanhanh', 'ok')).toContain('Không tìm thấy')
  })
})

// ===== Với engine thật =====

const quote: SymbolQuote = {
  symbol: 'FPT',
  ref_price: 100_000,
  ceiling_price: 107_000,
  floor_price: 93_000,
  last_price: 100_000,
  indicative_price: null,
  last_qty: 100,
  total_volume: 0,
  bid_price: 99_900,
  ask_price: 100_100,
  tick_direction: 0,
}

function engineSetup(limitPrice: number) {
  const engine = createOrderEngine({ random: () => 0 })
  let seconds = 10 * 3600
  const marketAt = (value: number): MarketState => ({ trading_date: DAY, sim_seconds: value, quote_age_seconds: 0, session: getSessionAt(value), speed: 1, quotes: [quote] })
  engine.onMarketTick(marketAt(seconds))
  const id = engine.createOrder(
    {
      client_request_id: 'req',
      account_no: '058C123456',
      symbol: 'FPT',
      side: 'BUY',
      total_qty: 1_000,
      limit_price: limitPrice,
      strategy_type: 'ICEBERG',
      persistence_mode: 'DAY',
      valid_to: null,
      parameters: [{ parameter_code: 'slice_qty', parameter_value: '500', data_type: 'INTEGER' }],
    },
    'tester',
  ).parent_order_id
  const tick = (count = 1) => {
    for (let index = 0; index < count; index += 1) {
      seconds += 1
      engine.onMarketTick(marketAt(seconds))
    }
  }
  const run = () => reconcile(reconInputFromEngine(engine, ALL_DAYS, `${DAY}T${formatClock(seconds)}`))
  return { engine, id, tick, run }
}

describe('reconcile với engine', () => {
  it('khớp trùng bị bỏ qua đúng 1 lần: một dòng DUP_FILL_IGNORED, Execution và KL không đổi, không lệch nào khác', () => {
    const { engine, id, tick, run } = engineSetup(101_000)
    tick(6)
    const executions = engine.getExecutions(id)
    expect(executions.length).toBeGreaterThan(0)
    const last = executions.at(-1)!

    engine.injectDuplicateFill(id)
    expect(engine.getExecutions(id)).toHaveLength(executions.length)
    expect(engine.getExecutions(id).filter((item) => item.exchange_match_id === last.exchange_match_id)).toHaveLength(1)
    expect(engine.getOrder(id).executed_qty).toBe(executions.reduce((sum, item) => sum + item.qty, 0))

    const result = run()
    expect(result.rows.map((item) => item.type)).toEqual(['DUP_FILL_IGNORED'])
    expect(result.rows[0].oms_value).toBe(`Ghi 1 lần khớp ${last.exchange_match_id}`)
  })

  it('mất ACK sau khi Core tạo lệnh: UNKNOWN_OPEN, tra Core xong thành UNKNOWN_RESOLVED "Core có lệnh"', () => {
    const { engine, id, tick, run } = engineSetup(90_000)
    engine.injectTimeout(id, 'TIMEOUT_AFTER_CORE')
    tick(2 + SYSTEM_PARAM_DEFAULTS.ACK_TIMEOUT_SECONDS + 2)
    const unknown = engine.getChildren(id).find((item) => item.status === 'UNKNOWN')!
    expect(run().rows).toEqual([expect.objectContaining({ type: 'UNKNOWN_OPEN', child_order_id: unknown.child_order_id })])

    engine.reconcileChildNow(unknown.child_order_id, 'vanhanh')
    expect(run().rows).toEqual([expect.objectContaining({ type: 'UNKNOWN_RESOLVED', core_value: 'Core có lệnh', status: 'RESOLVED' })])
  })

  it('mất ACK trước khi Core tạo lệnh: đối soát ra "Core không có lệnh"', () => {
    const { engine, id, tick, run } = engineSetup(90_000)
    engine.injectTimeout(id, 'TIMEOUT_BEFORE_CORE')
    tick(2 + SYSTEM_PARAM_DEFAULTS.ACK_TIMEOUT_SECONDS + 2)
    const unknown = engine.getChildren(id).find((item) => item.status === 'UNKNOWN')!
    engine.reconcileChildNow(unknown.child_order_id, 'vanhanh')
    expect(run().rows.filter((item) => item.type === 'UNKNOWN_RESOLVED')).toEqual([expect.objectContaining({ core_value: 'Core không có lệnh' })])
  })
})

describe('reconcile với lệnh mẫu', () => {
  it('mở màn là thấy ít nhất 1 dòng mỗi loại (trừ OVERFILL) trong 5 phiên', () => {
    const now = new Date(2026, 10, 16, 9, 10)
    const engine = createOrderEngine()
    engine.load(createSeedData(now))
    const result = reconcile(reconInputFromEngine(engine, { from: '2026-11-10', to: DAY }, `${DAY}T09:10:00`))
    const types = new Set(result.rows.map((item) => item.type))
    const expected: ReconType[] = ['STATUS_MISMATCH', 'QTY_MISMATCH', 'UNKNOWN_OPEN', 'UNKNOWN_RESOLVED', 'DUP_FILL_IGNORED', 'PARENT_SUM_MISMATCH']
    for (const type of expected) expect(types.has(type), type).toBe(true)
    expect(types.has('OVERFILL')).toBe(false)
    expect(result.checked_children).toBeGreaterThan(result.matched_children)
  })
})

describe('engine chạy bình thường không sinh chênh lệch giả', () => {
  it('lệnh mẫu chạy hết ngày ở x60: chỉ còn các dòng mẫu, không thêm lệch trạng thái, KL, tổng hay vượt KL', () => {
    const now = new Date(2026, 10, 16, 9, 10)
    let state = 7
    const random = () => {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
      return state / 2 ** 32
    }
    const engine = createOrderEngine({ random })
    engine.load(createSeedData(now))
    const simulator = createMarketSimulator({ startDate: now, random })
    simulator.subscribe((market) => {
      engine.onMarketTick(market)
      engine.drainDepthTakes().forEach((take) => simulator.consumeDepth(take.symbol, take.side, take.price, take.qty))
    })
    const range = { from: '2026-11-10', to: DAY }
    const clock = () => `${simulator.getState().trading_date}T${formatClock(simulator.getState().sim_seconds)}`
    const baseline = reconcile(reconInputFromEngine(engine, range, clock())).rows
      .filter((item) => item.type !== 'UNKNOWN_OPEN')
      .map((item) => item.id)
    simulator.setSpeed(60)
    for (let index = 0; index < 400; index += 1) {
      simulator.tick()
      const extra = reconcile(reconInputFromEngine(engine, range, clock())).rows.filter(
        (item) => !baseline.includes(item.id) && item.type !== 'UNKNOWN_OPEN' && item.type !== 'UNKNOWN_RESOLVED',
      )
      expect(extra, clock()).toEqual([])
    }
    expect(simulator.getState().session).toBe('CLOSED')
  })
})

describe('OVERFILL luôn bằng 0 với mọi kịch bản Demo', () => {
  it.each(SCENARIOS.map((scenario, index) => [scenario.number, index] as const))('Scenario %i', (_number, index) => {
    const env = createDemoEnv()
    createRunner({ scenario: SCENARIOS[index], env }).runToEnd()
    const state = env.simulator.getState()
    const result = reconcile(reconInputFromEngine(env.engine, ALL_DAYS, `${state.trading_date}T${formatClock(state.sim_seconds)}`))
    expect(result.rows.filter((item) => item.type === 'OVERFILL')).toEqual([])
    expect(result.rows.filter((item) => item.type === 'PARENT_SUM_MISMATCH')).toEqual([])
  })
})
