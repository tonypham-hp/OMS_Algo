import { describe, expect, it } from 'vitest'
import { SYSTEM_PARAM_DEFAULTS } from '@/config/systemParams'
import type { MarketState, StrategyParameter, SymbolQuote } from '@/types'
import { getSessionAt } from '@/utils/hose'
import { buildCoreLedger, createOrderEngine, type EngineState } from './engine'
import { createSeedData } from './seedOrders'

const ACK = SYSTEM_PARAM_DEFAULTS.ACK_TIMEOUT_SECONDS
const TODAY = '2026-11-06'
const AT_1000 = 10 * 3600

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

const marketAt = (seconds: number): MarketState => ({
  trading_date: TODAY,
  sim_seconds: seconds,
  quote_age_seconds: 0,
  session: getSessionAt(seconds),
  speed: 1,
  quotes: [quote],
})

const slice = (qty: number): StrategyParameter[] => [{ parameter_code: 'slice_qty', parameter_value: String(qty), data_type: 'INTEGER' }]

/** limitPrice 90.000: gửi được nhưng không khớp. 101.000: khớp ngay ở phiên liên tục. */
function setup(limitPrice = 90_000) {
  const engine = createOrderEngine({ random: () => 0 })
  let seconds = AT_1000
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
      parameters: slice(500),
    },
    'tester',
  ).parent_order_id
  const tick = (count = 1) => {
    for (let index = 0; index < count; index += 1) {
      seconds += 1
      engine.onMarketTick(marketAt(seconds))
    }
  }
  const ledgerOf = () => engine.listCoreLedger().filter((entry) => entry.parent_order_id === id)
  return { engine, id, tick, ledgerOf }
}

describe('Sổ phía Core', () => {
  it('lệnh con có ACK: Core giữ lệnh, cùng mã lệnh Core', () => {
    const { engine, id, tick, ledgerOf } = setup()
    tick(2)
    const child = engine.getChildren(id)[0]
    expect(child.status).toBe('ACKNOWLEDGED')
    expect(ledgerOf()).toEqual([expect.objectContaining({ child_order_id: child.child_order_id, core_order_id: child.core_order_id, status: 'ACKNOWLEDGED', filled_qty: 0 })])
  })

  it('timeout sau khi Core tạo lệnh: OMS UNKNOWN, Core đã có lệnh; đối soát xong thì có mã lệnh Core', () => {
    const { engine, id, tick, ledgerOf } = setup()
    engine.injectTimeout(id, 'TIMEOUT_AFTER_CORE')
    tick(2 + ACK)
    const child = engine.getChildren(id)[0]
    expect(child.status).toBe('UNKNOWN')
    expect(ledgerOf()).toEqual([expect.objectContaining({ status: 'ACKNOWLEDGED', core_order_id: null })])

    engine.reconcileChildNow(child.child_order_id, 'vanhanh')
    expect(child.status).toBe('ACKNOWLEDGED')
    expect(ledgerOf()[0].core_order_id).toBe(child.core_order_id)
  })

  it('timeout trước khi Core tạo lệnh: Core không có lệnh, đối soát xong vẫn không có', () => {
    const { engine, id, tick, ledgerOf } = setup()
    engine.injectTimeout(id, 'TIMEOUT_BEFORE_CORE')
    tick(2 + ACK)
    const child = engine.getChildren(id)[0]
    expect(child.status).toBe('UNKNOWN')
    expect(ledgerOf()).toEqual([])
    engine.reconcileChildNow(child.child_order_id, 'vanhanh')
    expect(child.status).toBe('CANCELLED')
    expect(ledgerOf().some((entry) => entry.child_order_id === child.child_order_id)).toBe(false)
  })

  it('khớp: Core cộng KL đúng một lần, báo khớp trùng không cộng thêm', () => {
    const { engine, id, tick, ledgerOf } = setup(101_000)
    tick(6)
    const filled = engine.getChildren(id).reduce((sum, child) => sum + child.filled_qty, 0)
    expect(filled).toBeGreaterThan(0)
    const before = ledgerOf().reduce((sum, entry) => sum + entry.filled_qty, 0)
    expect(before).toBe(filled)

    engine.injectDuplicateFill(id)
    engine.injectDuplicateFill(id)
    expect(ledgerOf().reduce((sum, entry) => sum + entry.filled_qty, 0)).toBe(before)
    for (const child of engine.getChildren(id).filter((item) => item.core_order_id !== null)) {
      const entry = ledgerOf().find((item) => item.child_order_id === child.child_order_id)
      expect(entry?.status).toBe(child.status === 'ACKNOWLEDGED' ? 'ACKNOWLEDGED' : child.status)
    }
  })

  it('hủy lệnh cha: Core cũng ghi lệnh con đã hủy', () => {
    const { engine, id, tick, ledgerOf } = setup()
    tick(2)
    engine.cancelOrder(id, 'tester')
    tick(1)
    expect(engine.getChildren(id).every((child) => child.status === 'CANCELLED')).toBe(true)
    expect(ledgerOf().every((entry) => entry.status === 'CANCELLED')).toBe(true)
  })

  it('lưu và nạp lại giữ nguyên sổ; bản lưu cũ không có sổ thì dựng lại từ lệnh con', () => {
    const { engine, tick } = setup()
    tick(2)
    const state = JSON.parse(JSON.stringify(engine.exportState())) as EngineState
    const restored = createOrderEngine()
    restored.importState(state)
    expect(restored.listCoreLedger()).toEqual(engine.listCoreLedger())

    const legacy = JSON.parse(JSON.stringify(engine.exportState())) as EngineState
    delete legacy.coreLedger
    const fromLegacy = createOrderEngine()
    fromLegacy.importState(legacy)
    expect(fromLegacy.listCoreLedger().map((entry) => entry.child_order_id)).toEqual(engine.listCoreLedger().map((entry) => entry.child_order_id))
  })

  it('lệnh mẫu: sổ Core dựng từ lệnh con có mã Core, áp các chỗ ghi lệch mẫu', () => {
    const seed = createSeedData(new Date(2026, 10, 16))
    const engine = createOrderEngine()
    engine.load(seed)
    const ledger = engine.listCoreLedger()
    expect(seed.coreOverrides?.length).toBe(2)
    for (const override of seed.coreOverrides ?? []) {
      const entry = ledger.find((item) => item.child_order_id === override.child_order_id)
      expect(entry).toMatchObject(override)
    }
    // Lệnh con UNKNOWN và lệnh con đối soát ra "Core không có lệnh" không có trong sổ.
    for (const child of seed.children.filter((item) => item.core_order_id === null)) {
      expect(ledger.some((entry) => entry.child_order_id === child.child_order_id)).toBe(false)
    }
    expect(buildCoreLedger(seed.children)).toHaveLength(ledger.length)
  })

  it('ghi quyết định đối soát thành OrderEvent DECISION kèm ghi chú, không đổi trạng thái lệnh', () => {
    const { engine, id, tick } = setup()
    tick(2)
    const before = engine.getOrder(id).status
    const event = engine.logReconDecision({ parent_order_id: id, child_order_id: null, row_id: 'QTY_MISMATCH:X', step: 'RESOLVE_REQUESTED', note: 'Đã gọi Core', user_id: 'vanhanh' })
    expect(event).toMatchObject({ action: 'DECISION', old_value: 'RECON:QTY_MISMATCH:X', new_value: 'RESOLVE_REQUESTED', reason: 'Đã gọi Core', user_id: 'vanhanh', channel: 'WEB' })
    expect(engine.getOrder(id).status).toBe(before)
  })
})
