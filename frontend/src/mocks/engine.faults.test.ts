import { describe, expect, it } from 'vitest'
import type { MarketState, NotificationType, OrderEventAction, SessionCode, StrategyParameter, SymbolQuote } from '@/types'
import { getSessionAt } from '@/utils/hose'
import { getReopenBlock } from '@/utils/orderActions'
import { createOrderEngine, isChildLive, MAX_DATA_DELAY, type OrderEngine } from './engine'
import { createSeedData } from './seedOrders'
import { createMarketSimulator } from './simulator'

const TODAY = '2026-11-06'
const AT_1000 = 10 * 3600
const AT_0905 = 9 * 3600 + 5 * 60
const ACCOUNT_A = '058C123456'
const ACCOUNT_B = '058C234567'

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

function marketAt(seconds: number, quoteAge = 0, session?: SessionCode): MarketState {
  return {
    trading_date: TODAY,
    sim_seconds: seconds,
    quote_age_seconds: quoteAge,
    session: session ?? getSessionAt(seconds),
    speed: 1,
    quotes: [quote],
  }
}

const slice = (qty: number): StrategyParameter[] => [
  { parameter_code: 'slice_qty', parameter_value: String(qty), data_type: 'INTEGER' },
]

/** Iceberg giá thấp hơn thị trường: lệnh con được gửi nhưng không khớp, nên kết quả không phụ thuộc giá. */
function setup(accountNo = ACCOUNT_A, limitPrice = 90_000, random = () => 0) {
  const engine = createOrderEngine({ random })
  let seconds = AT_1000
  engine.onMarketTick(marketAt(seconds))
  const place = (account = accountNo) =>
    engine.createOrder(
      {
        client_request_id: 'req',
        account_no: account,
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
  const tick = (count = 1, quoteAge = 0) => {
    for (let index = 0; index < count; index += 1) {
      seconds += 1
      engine.onMarketTick(marketAt(seconds, quoteAge))
    }
  }
  return { engine, place, tick }
}

const hasEvent = (engine: OrderEngine, id: string, action: OrderEventAction) =>
  engine.getEvents(id).some((event) => event.action === action)
const hasNotification = (engine: OrderEngine, id: string, type: NotificationType) =>
  engine.getNotifications(id).some((item) => item.notification_type === type)
const childStatuses = (engine: OrderEngine, id: string) => engine.getChildren(id).map((child) => child.status)

describe('TC-E2E-130 Core từ chối lệnh con', () => {
  it('TC-E2E-130 từ chối một lần: Child REJECTED, lệnh cha vẫn chạy và sinh Child mới', () => {
    const { engine, place, tick } = setup()
    const id = place()
    engine.injectRejectNext(id)
    tick(2) // Nhịp 1 sinh lệnh con, nhịp 2 gửi đi và bị từ chối, rồi sinh lại.

    expect(childStatuses(engine, id)).toEqual(['REJECTED', 'CREATED'])
    expect(engine.getOrder(id).status).toBe('ACTIVE')
    expect(engine.getWorkingQty(id)).toBe(500)
    expect(hasEvent(engine, id, 'REJECT')).toBe(true)
    expect(hasNotification(engine, id, 'CHILD_REJECTED')).toBe(true)
  })

  it('TC-E2E-130 từ chối 2 lần liên tiếp: Parent PAUSED_SYSTEM, không sinh thêm Child', () => {
    const { engine, place, tick } = setup()
    const id = place()
    engine.injectRejectNext(id)
    engine.injectRejectNext(id)
    tick(3)

    expect(engine.getOrder(id)).toMatchObject({ status: 'PAUSED_SYSTEM', reason_code: 'CHILD_REJECTED_REPEAT' })
    expect(childStatuses(engine, id)).toEqual(['REJECTED', 'REJECTED'])
    expect(hasEvent(engine, id, 'PAUSE')).toBe(true)
    expect(hasNotification(engine, id, 'PARENT_PAUSED')).toBe(true)
    tick(3)
    expect(engine.getChildren(id)).toHaveLength(2)
  })

  it('TC-E2E-130 giữa hai lần từ chối có Child được Core nhận thì không tạm dừng', () => {
    const { engine, place, tick } = setup()
    const id = place()
    engine.injectRejectNext(id)
    tick(3) // Child 1 bị từ chối, Child 2 được nhận.
    expect(childStatuses(engine, id)).toEqual(['REJECTED', 'ACKNOWLEDGED'])

    // Hủy Child đang chờ bằng tạm dừng và tiếp tục, để có Child tiếp theo cho lần từ chối thứ hai.
    engine.pauseOrder(id, 'tester')
    engine.resumeOrder(id, 'tester')
    engine.injectRejectNext(id)
    tick(2)

    expect(engine.getOrder(id).status).toBe('ACTIVE')
    expect(engine.getOrder(id).reason_code).toBeNull()
  })

  it('TC-E2E-130 chỉ bơm được vào lệnh đang chạy', () => {
    const { engine, place } = setup()
    const id = place()
    engine.pauseOrder(id, 'tester')
    expect(() => engine.injectRejectNext(id)).toThrow('đang chạy')
  })
})

describe('TC-E2E-140 timeout trước khi Core tạo lệnh', () => {
  it('TC-E2E-140 hủy Child UNKNOWN rồi sinh đúng 1 Child mới', () => {
    const { engine, place, tick } = setup()
    const id = place()
    engine.injectTimeout(id, 'TIMEOUT_BEFORE_CORE')
    tick(2)
    expect(childStatuses(engine, id)).toEqual(['UNKNOWN'])
    expect(hasEvent(engine, id, 'CHILD_UNKNOWN')).toBe(true)
    expect(hasNotification(engine, id, 'CHILD_UNKNOWN')).toBe(true)
    tick(3)
    expect(engine.getChildren(id)).toHaveLength(1) // Chưa đối soát xong thì chưa được gửi lại.

    tick(5)
    expect(childStatuses(engine, id)).toEqual(['CANCELLED', 'ACKNOWLEDGED'])
    expect(engine.getWorkingQty(id)).toBe(500)
    expect(hasEvent(engine, id, 'RECOVERY')).toBe(true)
    expect(hasNotification(engine, id, 'CHILD_RECOVERED')).toBe(true)
  })

  it.each([0, 0.49, 0.5, 0.99])('TC-E2E-140 kết cục cố định, không phụ thuộc số ngẫu nhiên (%s)', (value) => {
    const { engine, place, tick } = setup(ACCOUNT_A, 90_000, () => value)
    const id = place()
    engine.injectTimeout(id, 'TIMEOUT_BEFORE_CORE')
    tick(10)
    expect(childStatuses(engine, id)).toEqual(['CANCELLED', 'ACKNOWLEDGED'])
  })
})

describe('TC-E2E-141 timeout nhưng Core đã tạo lệnh', () => {
  it('TC-E2E-141 Child UNKNOWN vẫn tính là working, không gửi trùng trong lúc chờ', () => {
    const { engine, place, tick } = setup()
    const id = place()
    engine.injectTimeout(id, 'TIMEOUT_AFTER_CORE')
    tick(2)

    expect(childStatuses(engine, id)).toEqual(['UNKNOWN'])
    expect(engine.getWorkingQty(id)).toBe(500)
    expect(hasEvent(engine, id, 'CHILD_UNKNOWN')).toBe(true)
    expect(hasNotification(engine, id, 'CHILD_UNKNOWN')).toBe(true)
    tick(3)
    expect(engine.getChildren(id)).toHaveLength(1)
  })

  it('TC-E2E-141 giữ Child, đối soát về ACKNOWLEDGED, không sinh Child mới', () => {
    const { engine, place, tick } = setup()
    const id = place()
    engine.injectTimeout(id, 'TIMEOUT_AFTER_CORE')
    tick(2)
    const before = engine.getChildren(id)[0]
    tick(8)

    const children = engine.getChildren(id)
    expect(children).toHaveLength(1)
    expect(children[0]).toMatchObject({
      child_order_id: before.child_order_id,
      idempotency_key: before.idempotency_key,
      status: 'ACKNOWLEDGED',
    })
    expect(children[0].core_order_id).not.toBeNull()
    expect(hasEvent(engine, id, 'RECOVERY')).toBe(true)
    expect(hasNotification(engine, id, 'CHILD_RECOVERED')).toBe(true)
  })

  it.each([0, 0.49, 0.5, 0.99])('TC-E2E-141 kết cục cố định, không phụ thuộc số ngẫu nhiên (%s)', (value) => {
    const { engine, place, tick } = setup(ACCOUNT_A, 90_000, () => value)
    const id = place()
    engine.injectTimeout(id, 'TIMEOUT_AFTER_CORE')
    tick(10)
    expect(childStatuses(engine, id)).toEqual(['ACKNOWLEDGED'])
  })

  it('TC-E2E-141 Core đã nhận nhưng lệnh cha đã tạm dừng: hủy Child, không để lệnh sống trên lệnh dừng', () => {
    const { engine, place, tick } = setup()
    const id = place()
    engine.injectTimeout(id, 'TIMEOUT_AFTER_CORE')
    tick(2)
    engine.pauseOrder(id, 'tester')
    tick(6)

    expect(childStatuses(engine, id)).toEqual(['CANCELLED'])
  })

  it('TC-E2E-141 khớp tiếp sau đối soát: tổng KL không vượt total_qty', () => {
    const { engine, place, tick } = setup(ACCOUNT_A, 100_000)
    const id = place()
    engine.injectTimeout(id, 'TIMEOUT_AFTER_CORE')
    tick(60)

    const order = engine.getOrder(id)
    expect(order.status).toBe('COMPLETED')
    expect(order.executed_qty).toBe(1_000)
    expect(engine.getExecutions(id).reduce((sum, item) => sum + item.qty, 0)).toBe(1_000)
  })
})

describe('TC-E2E-150 báo khớp trùng', () => {
  it('TC-E2E-150 bỏ qua bản lặp: KL không tăng, ghi event và Notification', () => {
    const { engine, place, tick } = setup(ACCOUNT_A, 100_000)
    const id = place()
    tick(3)
    const executed = engine.getOrder(id).executed_qty
    const fills = engine.getExecutions(id).length
    const matchId = engine.getExecutions(id).at(-1)?.exchange_match_id
    expect(executed).toBeGreaterThan(0)

    engine.injectDuplicateFill(id)

    expect(engine.getOrder(id).executed_qty).toBe(executed)
    expect(engine.getExecutions(id)).toHaveLength(fills)
    expect(engine.getEvents(id).at(-1)).toMatchObject({
      action: 'DECISION',
      old_value: `DUPLICATE_FILL:${matchId}`,
      new_value: 'IGNORED',
    })
    expect(hasNotification(engine, id, 'DUPLICATE_FILL_IGNORED')).toBe(true)
  })

  it('TC-E2E-150 lệnh chưa có khớp thì báo lỗi, không ghi gì thêm', () => {
    const { engine, place } = setup()
    const id = place()
    const events = engine.getEvents(id).length
    expect(() => engine.injectDuplicateFill(id)).toThrow('chưa có lần khớp')
    expect(engine.getEvents(id)).toHaveLength(events)
  })
})

describe('TC-E2E-180 dữ liệu giá trễ', () => {
  it('TC-E2E-180 giá trễ: lệnh đang chạy PAUSED_SYSTEM và hủy Child, có giá mới thì chạy lại', () => {
    const { engine, place, tick } = setup()
    const id = place()
    tick(2)
    expect(childStatuses(engine, id)).toEqual(['ACKNOWLEDGED'])

    tick(1, MAX_DATA_DELAY)
    expect(engine.getOrder(id)).toMatchObject({ status: 'PAUSED_SYSTEM', reason_code: 'MARKET_DATA_STALE' })
    expect(childStatuses(engine, id)).toEqual(['CANCELLED'])
    expect(hasEvent(engine, id, 'PAUSE')).toBe(true)
    expect(hasNotification(engine, id, 'PARENT_PAUSED')).toBe(true)
    tick(2, MAX_DATA_DELAY)
    expect(engine.getChildren(id)).toHaveLength(1)

    tick(1)
    expect(engine.getOrder(id)).toMatchObject({ status: 'ACTIVE', reason_code: null })
    expect(hasEvent(engine, id, 'RESUME')).toBe(true)
    expect(hasNotification(engine, id, 'PARENT_RESUMED')).toBe(true)
    expect(engine.getChildren(id)).toHaveLength(2)
  })

  it('TC-E2E-180 chưa tới ngưỡng thì chưa tạm dừng', () => {
    const { engine, place, tick } = setup()
    const id = place()
    tick(1, MAX_DATA_DELAY - 1)
    expect(engine.getOrder(id).status).toBe('ACTIVE')
  })

  it('TC-E2E-180 lệnh đã khớp một phần chạy lại về PARTIALLY_EXECUTED', () => {
    const { engine, place, tick } = setup(ACCOUNT_A, 100_000)
    const id = place()
    tick(3)
    const executed = engine.getOrder(id).executed_qty
    expect(executed).toBeGreaterThan(0)
    tick(1, MAX_DATA_DELAY)
    tick(1)
    expect(engine.getOrder(id).status).toBe('PARTIALLY_EXECUTED')
  })

  it('TC-E2E-180 có giá mới không làm chạy lại lệnh tạm dừng vì lý do khác', () => {
    const { engine, place, tick } = setup()
    const byUser = place()
    const byKill = place(ACCOUNT_B)
    engine.pauseOrder(byUser, 'tester')
    engine.activateKillSwitch({ scope: 'ACCOUNT', account_no: ACCOUNT_B }, 'vanhanh')
    tick(1, MAX_DATA_DELAY)
    tick(1)

    expect(engine.getOrder(byUser).status).toBe('PAUSED_USER')
    expect(engine.getOrder(byKill)).toMatchObject({ status: 'PAUSED_SYSTEM', reason_code: 'KILL_SWITCH' })
  })

  it('TC-E2E-180 đồng hồ đã dừng ở cuối ngày vẫn chạy lại được khi có giá mới', () => {
    const { engine, place, tick } = setup()
    const id = place()
    tick(1, MAX_DATA_DELAY)
    expect(engine.getOrder(id).status).toBe('PAUSED_SYSTEM')

    // Cùng giờ giả lập với nhịp trước: đồng hồ không nhích, nhưng đã có giá mới.
    engine.onMarketTick(marketAt(AT_1000 + 1, 0))
    expect(engine.getOrder(id).status).toBe('ACTIVE')
  })

  it('TC-E2E-180 simulator: giá đứng yên, tuổi giá tăng, tắt lỗi thì nhịp sau có giá mới', () => {
    const simulator = createMarketSimulator({ random: () => 0, symbols: [{ symbol: 'FPT', ref_price: 100_000 }] })
    simulator.setSpeed(10)
    simulator.tick(1000)
    simulator.setFeedStale(true)
    const frozen = simulator.getState().quotes[0]

    simulator.tick(1000)
    simulator.tick(1000)
    expect(simulator.getState().quote_age_seconds).toBe(2)
    expect(simulator.getState().quotes[0]).toEqual({ ...frozen, tick_direction: 0 })

    simulator.setFeedStale(false)
    expect(simulator.getState().quote_age_seconds).toBe(2)
    simulator.tick(1000)
    expect(simulator.getState().quote_age_seconds).toBe(0)
  })
})

describe('TC-E2E-180 ngưỡng MAX_DATA_DELAY tính bằng giây thật', () => {
  it.each([1, 10, 60] as const)('TC-E2E-180 ở tốc độ x%s: trễ đúng sau 5 giây thật', (speed) => {
    const simulator = createMarketSimulator({ random: () => 0, symbols: [{ symbol: 'FPT', ref_price: 100_000 }] })
    const engine = createOrderEngine({ random: () => 0 })
    simulator.setSpeed(speed)
    simulator.subscribe((state) => engine.onMarketTick(state))
    const id = engine.createOrder(
      {
        client_request_id: 'req',
        account_no: ACCOUNT_A,
        symbol: 'FPT',
        side: 'BUY',
        total_qty: 1_000,
        limit_price: 90_000,
        strategy_type: 'ICEBERG',
        persistence_mode: 'DAY',
        valid_to: null,
        parameters: slice(500),
      },
      'tester',
    ).parent_order_id
    simulator.setFeedStale(true)

    for (let second = 1; second < MAX_DATA_DELAY; second += 1) simulator.tick(1000)
    expect(simulator.getState().quote_age_seconds).toBe(MAX_DATA_DELAY - 1)
    expect(engine.getOrder(id).status).toBe('ACTIVE')

    simulator.tick(1000)
    expect(simulator.getState().quote_age_seconds).toBe(MAX_DATA_DELAY)
    expect(engine.getOrder(id)).toMatchObject({ status: 'PAUSED_SYSTEM', reason_code: 'MARKET_DATA_STALE' })
  })
})

describe('Vận hành mở lại lệnh PAUSED_SYSTEM', () => {
  it('ghi RESUME kèm user_id và lý do, có Notification, lệnh chạy tiếp', () => {
    const { engine, place, tick } = setup()
    const id = place()
    engine.injectRejectNext(id)
    engine.injectRejectNext(id)
    tick(3)
    expect(engine.getOrder(id).reason_code).toBe('CHILD_REJECTED_REPEAT')

    engine.reopenOrder(id, '  Đã kiểm tra với Core  ', 'vanhanh')

    expect(engine.getOrder(id)).toMatchObject({ status: 'ACTIVE', reason_code: null })
    expect(engine.getEvents(id).at(-1)).toMatchObject({
      action: 'RESUME',
      user_id: 'vanhanh',
      old_value: 'PAUSED_SYSTEM',
      new_value: 'ACTIVE',
      reason: 'Đã kiểm tra với Core',
    })
    expect(engine.getNotifications(id).at(-1)).toMatchObject({ notification_type: 'PARENT_RESUMED' })
    tick(2)
    expect(engine.getChildren(id).at(-1)?.status).toBe('ACKNOWLEDGED')
  })

  it('đếm lại số lần từ chối: một lần từ chối sau khi mở lại chưa làm tạm dừng', () => {
    const { engine, place, tick } = setup()
    const id = place()
    engine.injectRejectNext(id)
    engine.injectRejectNext(id)
    tick(3)
    engine.reopenOrder(id, 'Đã xử lý', 'vanhanh')
    engine.injectRejectNext(id)
    tick(2)
    expect(engine.getOrder(id).status).toBe('ACTIVE')
  })

  it('đã khớp một phần thì về PARTIALLY_EXECUTED', () => {
    const { engine, place, tick } = setup(ACCOUNT_A, 100_000)
    const id = place()
    tick(3)
    engine.activateKillSwitch({ scope: 'ALL' }, 'vanhanh')
    engine.releaseKillSwitch({ scope: 'ALL' })
    engine.reopenOrder(id, 'Đã xử lý', 'vanhanh')
    expect(engine.getOrder(id).status).toBe('PARTIALLY_EXECUTED')
  })

  it.each(['', '   '])('bắt buộc có lý do (%j)', (reason) => {
    const { engine, place } = setup()
    const id = place()
    engine.activateKillSwitch({ scope: 'ALL' }, 'vanhanh')
    engine.releaseKillSwitch({ scope: 'ALL' })
    expect(() => engine.reopenOrder(id, reason, 'vanhanh')).toThrow('lý do')
    expect(engine.getOrder(id).status).toBe('PAUSED_SYSTEM')
  })

  it('kill switch còn bật thì không cho mở lại, gỡ rồi mới được', () => {
    const { engine, place } = setup()
    const id = place()
    engine.activateKillSwitch({ scope: 'ACCOUNT', account_no: ACCOUNT_A }, 'vanhanh')
    expect(() => engine.reopenOrder(id, 'Thử mở', 'vanhanh')).toThrow('Kill switch')

    engine.releaseKillSwitch({ scope: 'ACCOUNT', account_no: ACCOUNT_A })
    engine.reopenOrder(id, 'Đã hết sự cố', 'vanhanh')
    expect(engine.getOrder(id).status).toBe('ACTIVE')
  })

  it('giá ngoài biên độ thì phải sửa giá, dữ liệu giá còn trễ thì chưa mở được', () => {
    expect(getReopenBlock('PRICE_OUT_OF_BAND', false, false)).toContain('sửa giá')
    expect(getReopenBlock('KILL_SWITCH', false, true)).toContain('còn trễ')
    expect(getReopenBlock('KILL_SWITCH', true, false)).toContain('Kill switch')
    expect(getReopenBlock(null, false, false)).toBeNull()

    const { engine, place, tick } = setup()
    const id = place()
    engine.activateKillSwitch({ scope: 'ALL' }, 'vanhanh')
    engine.releaseKillSwitch({ scope: 'ALL' })
    tick(1, MAX_DATA_DELAY)
    expect(() => engine.reopenOrder(id, 'Thử mở', 'vanhanh')).toThrow('còn trễ')
  })

  it('chỉ áp dụng cho lệnh PAUSED_SYSTEM', () => {
    const { engine, place } = setup()
    const id = place()
    expect(() => engine.reopenOrder(id, 'Thử mở', 'vanhanh')).toThrow('hệ thống tạm dừng')
    engine.pauseOrder(id, 'tester')
    expect(() => engine.reopenOrder(id, 'Thử mở', 'vanhanh')).toThrow('hệ thống tạm dừng')
  })

  it('đường Tiếp tục của khách hàng vẫn bị chặn với PAUSED_SYSTEM', () => {
    const { engine, place } = setup()
    const id = place()
    engine.activateKillSwitch({ scope: 'ALL' }, 'vanhanh')
    engine.releaseKillSwitch({ scope: 'ALL' })
    expect(() => engine.resumeOrder(id, 'khachhang')).toThrow()
    expect(engine.getOrder(id).status).toBe('PAUSED_SYSTEM')
  })
})

describe('Đối soát ngay Child UNKNOWN', () => {
  it('lệnh mẫu VHM: Child UNKNOWN chưa có Core ID thì hủy, ghi RECOVERY kèm người thao tác, rồi mở lại được', () => {
    const engine = createOrderEngine({ random: () => 0 })
    engine.load(createSeedData(new Date(2026, 10, 6)))
    engine.onMarketTick(marketAt(AT_1000))
    const vhm = engine.listOrders().find((order) => order.symbol === 'VHM')?.parent_order_id ?? ''
    const unknown = engine.getChildren(vhm).find((child) => child.status === 'UNKNOWN')
    const executed = engine.getOrder(vhm).executed_qty
    expect(unknown?.core_order_id).toBeNull()
    expect(engine.getWorkingQty(vhm)).toBe(1_000)

    engine.reconcileChildNow(unknown?.child_order_id ?? '', 'vanhanh')

    expect(engine.getChildren(vhm).find((child) => child.child_order_id === unknown?.child_order_id)?.status).toBe('CANCELLED')
    expect(engine.getWorkingQty(vhm)).toBe(0)
    expect(engine.getOrder(vhm).executed_qty).toBe(executed)
    expect(engine.getEvents(vhm).at(-1)).toMatchObject({ action: 'RECOVERY', user_id: 'vanhanh', new_value: 'CANCELLED' })
    expect(hasNotification(engine, vhm, 'CHILD_RECOVERED')).toBe(true)

    engine.reopenOrder(vhm, 'Đã đối soát với Core', 'vanhanh')
    expect(engine.getOrder(vhm).status).toBe('PARTIALLY_EXECUTED')
  })

  it('TC-E2E-141 đối soát ngay theo đúng kết cục đã định, không chờ hết thời gian', () => {
    const { engine, place, tick } = setup()
    const id = place()
    engine.injectTimeout(id, 'TIMEOUT_AFTER_CORE')
    tick(2)
    engine.reconcileChildNow(engine.getChildren(id)[0].child_order_id, 'vanhanh')
    expect(childStatuses(engine, id)).toEqual(['ACKNOWLEDGED'])
    tick(8)
    expect(engine.getChildren(id)).toHaveLength(1) // Không đối soát lần hai khi hết thời gian.
  })

  it('TC-E2E-140 đối soát ngay: hủy Child và sinh đúng 1 Child mới', () => {
    const { engine, place, tick } = setup()
    const id = place()
    engine.injectTimeout(id, 'TIMEOUT_BEFORE_CORE')
    tick(2)
    engine.reconcileChildNow(engine.getChildren(id)[0].child_order_id, 'vanhanh')
    tick(8)
    expect(childStatuses(engine, id)).toEqual(['CANCELLED', 'ACKNOWLEDGED'])
  })

  it('Child không còn UNKNOWN thì báo lỗi', () => {
    const { engine, place, tick } = setup()
    const id = place()
    tick(2)
    expect(() => engine.reconcileChildNow(engine.getChildren(id)[0].child_order_id, 'vanhanh')).toThrow('UNKNOWN')
  })
})

describe('Kill switch', () => {
  it('Kill switch toàn hệ thống: hủy Child chưa khớp, mọi lệnh chưa kết thúc PAUSED_SYSTEM', () => {
    const { engine, place, tick } = setup()
    const running = place()
    const paused = place(ACCOUNT_B)
    tick(2)
    engine.pauseOrder(paused, 'tester')

    engine.activateKillSwitch({ scope: 'ALL' }, 'vanhanh')

    for (const id of [running, paused]) {
      expect(engine.getOrder(id)).toMatchObject({ status: 'PAUSED_SYSTEM', reason_code: 'KILL_SWITCH' })
      expect(engine.getChildren(id).some((child) => isChildLive(child.status))).toBe(false)
      expect(engine.getEvents(id).find((event) => event.action === 'PAUSE' && event.new_value === 'PAUSED_SYSTEM')?.user_id).toBe('vanhanh')
      expect(engine.getEvents(id).some((event) => event.new_value === 'KILL_SWITCH:ALL')).toBe(true)
      expect(hasNotification(engine, id, 'PARENT_PAUSED')).toBe(true)
    }
    tick(3)
    expect(engine.getChildren(running)).toHaveLength(1)
  })

  it('Kill switch theo tài khoản: chỉ dừng tài khoản đó', () => {
    const { engine, place, tick } = setup()
    const hit = place(ACCOUNT_A)
    const other = place(ACCOUNT_B)
    tick(2)

    engine.activateKillSwitch({ scope: 'ACCOUNT', account_no: ACCOUNT_A }, 'vanhanh')

    expect(engine.getOrder(hit).status).toBe('PAUSED_SYSTEM')
    expect(engine.getOrder(other).status).toBe('ACTIVE')
    expect(childStatuses(engine, other)).toEqual(['ACKNOWLEDGED'])
    expect(() => place(ACCOUNT_A)).toThrow('kill switch')
    expect(() => place(ACCOUNT_B)).not.toThrow()
  })

  it('Kill switch giữ Child UNKNOWN vì chưa biết Core đang giữ gì', () => {
    const { engine, place, tick } = setup()
    const id = place()
    engine.injectTimeout(id, 'TIMEOUT_AFTER_CORE')
    tick(2)
    engine.activateKillSwitch({ scope: 'ALL' }, 'vanhanh')
    expect(childStatuses(engine, id)).toEqual(['UNKNOWN'])

    // Đối soát xong, Core có nhận thì cũng hủy vì lệnh cha đã dừng.
    tick(6)
    expect(childStatuses(engine, id)).toEqual(['CANCELLED'])
  })

  it('Kill switch trong ATO: vẫn hủy Child ngay', () => {
    const engine = createOrderEngine({ random: () => 0 })
    engine.onMarketTick(marketAt(AT_0905))
    const id = engine.createOrder(
      {
        client_request_id: 'req',
        account_no: ACCOUNT_A,
        symbol: 'FPT',
        side: 'BUY',
        total_qty: 1_000,
        limit_price: 90_000,
        strategy_type: 'ICEBERG',
        persistence_mode: 'DAY',
        valid_to: null,
        parameters: slice(500),
      },
      'tester',
    ).parent_order_id
    engine.onMarketTick(marketAt(AT_0905 + 1))
    engine.onMarketTick(marketAt(AT_0905 + 2))
    expect(childStatuses(engine, id)).toEqual(['ACKNOWLEDGED'])
    expect(getSessionAt(AT_0905)).toBe('ATO')

    engine.activateKillSwitch({ scope: 'ALL' }, 'vanhanh')

    expect(childStatuses(engine, id)).toEqual(['CANCELLED'])
    expect(engine.getOrder(id).status).toBe('PAUSED_SYSTEM')
  })

  it('Gỡ kill switch: đặt được lệnh mới, lệnh cũ vẫn tạm dừng và không sinh Child', () => {
    const { engine, place, tick } = setup()
    const id = place()
    engine.activateKillSwitch({ scope: 'ALL' }, 'vanhanh')
    expect(() => place()).toThrow('kill switch')

    engine.releaseKillSwitch({ scope: 'ALL' })
    const created = place()
    tick(3)

    expect(engine.getOrder(id).status).toBe('PAUSED_SYSTEM')
    expect(engine.getChildren(id)).toHaveLength(0)
    expect(() => engine.resumeOrder(id, 'tester')).toThrow()
    expect(engine.getOrder(created).status).toBe('ACTIVE')
  })

  it('Lệnh bị kill switch vẫn hủy được, và bấm lại không ghi trùng', () => {
    const { engine, place, tick } = setup()
    const id = place()
    tick(1)
    engine.activateKillSwitch({ scope: 'ALL' }, 'vanhanh')
    const notifications = engine.getNotifications(id).length
    engine.activateKillSwitch({ scope: 'ALL' }, 'vanhanh')
    expect(engine.getNotifications(id)).toHaveLength(notifications)

    engine.cancelOrder(id, 'tester')
    expect(engine.getOrder(id).status).toBe('CANCELLED')
  })
})

describe('tổng quan vận hành', () => {
  it('đếm theo trạng thái và số Child lỗi, liệt kê đủ các loại cảnh báo có link tới lệnh', () => {
    const { engine, place, tick } = setup()
    const rejected = place()
    const unknown = place()
    const paused = place(ACCOUNT_B)
    engine.injectRejectNext(rejected)
    engine.injectTimeout(unknown, 'TIMEOUT_AFTER_CORE')
    tick(2)
    engine.activateKillSwitch({ scope: 'ACCOUNT', account_no: ACCOUNT_B }, 'vanhanh')

    const overview = engine.getOpsOverview()

    expect(overview.status_counts).toMatchObject({ ACTIVE: 2, PAUSED_SYSTEM: 1, COMPLETED: 0 })
    expect(overview.child_rejected).toBe(1)
    expect(overview.child_unknown).toBe(1)
    expect(overview.kill_switch).toEqual({ global: false, accounts: [ACCOUNT_B] })
    expect(overview.accounts).toEqual([ACCOUNT_A, ACCOUNT_B])
    const links = Object.fromEntries(overview.alerts.map((alert) => [alert.type, alert.parent_order_id]))
    expect(links).toEqual({ CHILD_REJECTED: rejected, CHILD_UNKNOWN: unknown, PARENT_PAUSED_SYSTEM: paused })
  })

  it('giá trễ có cảnh báo toàn hệ thống, không gắn với lệnh nào', () => {
    const { engine, tick } = setup()
    tick(1, MAX_DATA_DELAY)
    const overview = engine.getOpsOverview()
    expect(overview.is_feed_stale).toBe(true)
    expect(overview.quote_age_seconds).toBe(MAX_DATA_DELAY)
    expect(overview.alerts).toEqual([expect.objectContaining({ type: 'MARKET_DATA_STALE', parent_order_id: null })])
  })

  it('lỗi đang chờ hiện trong tổng quan, dùng xong thì mất', () => {
    const { engine, place, tick } = setup()
    const id = place()
    engine.injectRejectNext(id)
    expect(engine.getOpsOverview().pending_faults).toEqual([expect.objectContaining({ parent_order_id: id, type: 'REJECT' })])
    tick(2)
    expect(engine.getOpsOverview().pending_faults).toEqual([])
  })

  it('lệnh bị kill switch không còn lỗi đang chờ, vì không bao giờ gửi lệnh con nữa', () => {
    const { engine, place } = setup()
    const id = place()
    engine.injectTimeout(id, 'TIMEOUT_AFTER_CORE')
    engine.activateKillSwitch({ scope: 'ALL' }, 'vanhanh')
    expect(engine.getOpsOverview().pending_faults).toEqual([])
  })

  it('lệnh dừng vì giá trễ vẫn giữ lỗi đang chờ, và lỗi có tác dụng khi chạy lại', () => {
    const { engine, place, tick } = setup()
    const id = place()
    engine.injectRejectNext(id)
    tick(1, MAX_DATA_DELAY)
    expect(engine.getOpsOverview().pending_faults).toHaveLength(1)

    tick(3)
    expect(engine.getOpsOverview().pending_faults).toEqual([])
    expect(childStatuses(engine, id)).toContain('REJECTED')
  })
})

describe('lưu và nạp lại trạng thái bơm lỗi', () => {
  it('giữ lỗi đang chờ, đối soát đang chờ và kill switch', () => {
    const { engine, place, tick } = setup()
    const recovering = place(ACCOUNT_B)
    engine.injectTimeout(recovering, 'TIMEOUT_AFTER_CORE')
    tick(2)
    const waiting = place()
    engine.injectRejectNext(waiting)
    engine.activateKillSwitch({ scope: 'ACCOUNT', account_no: '058C345678' }, 'vanhanh')

    const restored = createOrderEngine({ random: () => 0 })
    restored.importState(JSON.parse(JSON.stringify(engine.exportState())))

    expect(restored.getOpsOverview().pending_faults).toHaveLength(1)
    expect(restored.getOpsOverview().kill_switch.accounts).toEqual(['058C345678'])
    for (let index = 0; index < 8; index += 1) restored.onMarketTick(marketAt(AT_1000 + 10 + index))
    expect(restored.getChildren(recovering)[0].status).toBe('ACKNOWLEDGED')
    expect(restored.getChildren(waiting)[0].status).toBe('REJECTED')
  })
})
