import { describe, expect, it } from 'vitest'
import type { CreateOrderRequest, MarketState, StrategyParameter, SystemParameterCode, SystemParameterValue } from '@/types'
import { getSessionAt } from '@/utils/hose'
import { createOrderEngine, isChildLive } from './engine'
import { createConfigStore } from './systemConfig'

const AT_1000 = 10 * 3600

function marketAt(seconds: number, quoteAge = 0, volume = 0): MarketState {
  return {
    trading_date: '2026-11-06',
    sim_seconds: seconds,
    quote_age_seconds: quoteAge,
    session: getSessionAt(seconds),
    speed: 1,
    quotes: [
      {
        symbol: 'FPT',
        ref_price: 100_000,
        ceiling_price: 107_000,
        floor_price: 93_000,
        last_price: 100_000,
        indicative_price: null,
        last_qty: 100,
        total_volume: volume,
        bid_price: 99_900,
        ask_price: 100_100,
        tick_direction: 0,
      },
    ],
  }
}

const int = (parameter_code: string, value: number): StrategyParameter => ({
  parameter_code,
  parameter_value: String(value),
  data_type: 'INTEGER',
})

function order(extra: Partial<CreateOrderRequest> = {}): CreateOrderRequest {
  return {
    client_request_id: 'req',
    account_no: '058C123456',
    symbol: 'FPT',
    side: 'BUY',
    total_qty: 10_000,
    limit_price: 99_000, // Thấp hơn giá khớp: lệnh con được gửi nhưng không tự khớp.
    strategy_type: 'ICEBERG',
    persistence_mode: 'DAY',
    valid_to: null,
    parameters: [int('slice_qty', 1_000)],
    ...extra,
  }
}

function setup() {
  const config = createConfigStore()
  const engine = createOrderEngine({ random: () => 0, config })
  let seconds = AT_1000
  engine.onMarketTick(marketAt(seconds))
  const tick = (count = 1, quoteAge = 0, volume = 0) => {
    for (let index = 0; index < count; index += 1) {
      seconds += 1
      engine.onMarketTick(marketAt(seconds, quoteAge, volume))
    }
  }
  /** Đổi tham số đúng luồng maker-checker: vanhanh tạo, vanhanh2 duyệt. */
  const change = (parameter_code: SystemParameterCode, new_value: SystemParameterValue) => {
    const request = config.createRequest({ parameter_code, new_value, reason: 'test' }, 'vanhanh')
    config.approveRequest(request.request_id, '', 'vanhanh2')
  }
  const place = (body = order()) => engine.createOrder(body, 'tester').parent_order_id
  const statuses = (id: string) => engine.getChildren(id).map((child) => child.status)
  return { config, engine, tick, change, place, statuses }
}

describe('MAX_CONSECUTIVE_REJECTS áp ngay sau khi duyệt', () => {
  it('mặc định 2: lần từ chối thứ 2 tạm dừng lệnh', () => {
    const { engine, tick, place } = setup()
    const id = place()
    engine.injectRejectNext(id)
    engine.injectRejectNext(id)
    tick(3)
    expect(engine.getOrder(id)).toMatchObject({ status: 'PAUSED_SYSTEM', reason_code: 'CHILD_REJECTED_REPEAT' })
  })

  it('đổi 2 → 3: lần từ chối thứ 2 không còn tạm dừng, lần thứ 3 mới dừng', () => {
    const { engine, tick, change, place, statuses } = setup()
    const id = place()
    change('MAX_CONSECUTIVE_REJECTS', 3)
    for (let index = 0; index < 3; index += 1) engine.injectRejectNext(id)

    tick(3) // Nhịp 1 sinh lệnh con; nhịp 2, 3 mỗi nhịp gửi một lệnh con và bị từ chối.
    expect(statuses(id)).toEqual(['REJECTED', 'REJECTED', 'CREATED'])
    expect(engine.getOrder(id)).toMatchObject({ status: 'ACTIVE', reason_code: null })

    tick()
    expect(statuses(id)).toEqual(['REJECTED', 'REJECTED', 'REJECTED'])
    expect(engine.getOrder(id)).toMatchObject({ status: 'PAUSED_SYSTEM', reason_code: 'CHILD_REJECTED_REPEAT' })
  })

  it('đổi giữa chừng: chuỗi từ chối đang có so với ngưỡng mới ở lần từ chối kế tiếp, không dừng ngược', () => {
    const { engine, tick, change, place } = setup()
    const id = place()
    engine.injectRejectNext(id)
    tick(2) // Từ chối lần 1 theo ngưỡng 2.
    change('MAX_CONSECUTIVE_REJECTS', 1)
    expect(engine.getOrder(id).status).toBe('ACTIVE') // Không tạm dừng ngược khi vừa duyệt.

    engine.injectRejectNext(id)
    tick()
    expect(engine.getOrder(id).status).toBe('PAUSED_SYSTEM')
  })
})

describe('MAX_DATA_DELAY_SECONDS áp ngay nhịp sau', () => {
  it('tăng lên 10 giây: giá trễ 5 giây không còn tạm dừng, 10 giây thì dừng', () => {
    const { engine, tick, change, place } = setup()
    const id = place()
    change('MAX_DATA_DELAY_SECONDS', 10)
    tick(1, 5)
    expect(engine.getOrder(id).status).toBe('ACTIVE')
    tick(1, 10)
    expect(engine.getOrder(id)).toMatchObject({ status: 'PAUSED_SYSTEM', reason_code: 'MARKET_DATA_STALE' })
    expect(engine.getOpsOverview().is_feed_stale).toBe(true)
  })

  it('giảm xuống 2 giây: lệnh đang chạy dừng ngay ở nhịp kế tiếp có giá trễ 2 giây', () => {
    const { engine, tick, change, place } = setup()
    const id = place()
    change('MAX_DATA_DELAY_SECONDS', 2)
    tick(1, 2)
    expect(engine.getOrder(id).status).toBe('PAUSED_SYSTEM')
  })
})

describe('ACK_TIMEOUT_SECONDS: chờ ACK ở SENDING trước khi UNKNOWN', () => {
  it('SENDING đúng N nhịp rồi mới UNKNOWN, trong lúc chờ không gửi trùng', () => {
    const { engine, tick, change, place, statuses } = setup()
    change('ACK_TIMEOUT_SECONDS', 4)
    const id = place()
    engine.injectTimeout(id, 'TIMEOUT_AFTER_CORE')
    tick(2) // Nhịp 1 sinh, nhịp 2 gửi.
    expect(statuses(id)).toEqual(['SENDING'])
    expect(engine.getWorkingQty(id)).toBe(1_000)

    tick(3)
    expect(statuses(id)).toEqual(['SENDING'])
    tick()
    expect(statuses(id)).toEqual(['UNKNOWN'])
    expect(engine.getEvents(id).map((event) => event.new_value)).toEqual(expect.arrayContaining(['SENDING', 'UNKNOWN']))

    tick(5) // Đối soát: Core đã nhận nên giữ đúng lệnh con đó.
    expect(statuses(id)).toEqual(['ACKNOWLEDGED'])
  })

  it('lệnh con đang chờ ACK lúc duyệt giữ thời gian chờ cũ, lệnh con gửi sau mới dùng giá trị mới', () => {
    const { engine, tick, change, place, statuses } = setup()
    const first = place()
    engine.injectTimeout(first, 'TIMEOUT_BEFORE_CORE')
    tick(2)
    change('ACK_TIMEOUT_SECONDS', 10)
    tick(3) // Mặc định 3 giây.
    expect(statuses(first)).toEqual(['UNKNOWN'])

    const second = place()
    engine.injectTimeout(second, 'TIMEOUT_BEFORE_CORE')
    tick(2)
    tick(9)
    expect(statuses(second)).toEqual(['SENDING'])
    tick()
    expect(statuses(second)).toEqual(['UNKNOWN'])
  })

  it('tạm dừng và kill switch giữ lệnh con SENDING; hủy lệnh thì đối soát ở nhịp sau', () => {
    const { engine, tick, place, statuses } = setup()
    const paused = place()
    const cancelled = place()
    engine.injectTimeout(paused, 'TIMEOUT_AFTER_CORE')
    engine.injectTimeout(cancelled, 'TIMEOUT_AFTER_CORE')
    tick(2)

    engine.pauseOrder(paused, 'tester')
    expect(statuses(paused)).toEqual(['SENDING'])
    engine.cancelOrder(cancelled, 'tester')
    expect(engine.getOrder(cancelled).status).toBe('CANCEL_PENDING')

    tick()
    expect(engine.getOrder(cancelled).status).toBe('CANCELLED')
    expect(statuses(cancelled)).toEqual(['CANCELLED'])
  })

  it('lưu và nạp lại giữa lúc chờ ACK vẫn đếm tiếp đúng', () => {
    const { engine, tick, place } = setup()
    const id = place()
    engine.injectTimeout(id, 'TIMEOUT_AFTER_CORE')
    tick(3) // Gửi ở nhịp 2, còn chờ 2 nhịp.

    const restored = createOrderEngine({ random: () => 0 })
    restored.importState(JSON.parse(JSON.stringify(engine.exportState())))
    restored.onMarketTick(marketAt(AT_1000 + 4))
    expect(restored.getChildren(id)[0].status).toBe('SENDING')
    restored.onMarketTick(marketAt(AT_1000 + 5))
    expect(restored.getChildren(id)[0].status).toBe('UNKNOWN')
  })
})

describe('luật đặt lệnh chỉ áp cho lệnh mới', () => {
  it('tắt Iceberg: lệnh mới bị từ chối, lệnh Iceberg đang chạy vẫn sinh lệnh con', () => {
    const { engine, tick, change, place } = setup()
    const running = place()
    tick(2) // Lệnh con đầu đã gửi đi.
    change('ENABLED_STRATEGIES', ['TWAP', 'POV'])

    expect(() => place()).toThrow(expect.objectContaining({ status: 422, message: expect.stringContaining('Iceberg đang tạm ngừng') }))
    const first = engine.getChildren(running)[0]
    engine.applyExecution({ child_order_id: first.child_order_id, exchange_match_id: 'M1', price: 99_000, qty: 1_000 })
    tick()
    expect(engine.getChildren(running)).toHaveLength(2)
    expect(engine.getChildren(running).filter((child) => isChildLive(child.status))).toHaveLength(1)
  })

  it('đổi khoảng slice: lệnh mới ngoài khoảng bị từ chối, lệnh đang chạy giữ slice lúc đặt', () => {
    const { engine, tick, change, place } = setup()
    const running = place(order({ parameters: [int('slice_qty', 500)] }))
    change('ICEBERG_MIN_SLICE', 1_000)

    expect(() => place(order({ parameters: [int('slice_qty', 500)] }))).toThrow('KL mỗi phần tối thiểu là 1.000 CP')
    expect(place(order({ parameters: [int('slice_qty', 1_000)] }))).toBeTruthy()
    tick()
    expect(engine.getChildren(running)[0].quantity).toBe(500)
  })

  it('hạ trần POV: lệnh mới vượt trần bị từ chối, lệnh POV đang chạy vẫn sinh theo tỷ lệ cũ', () => {
    const { engine, tick, change, place } = setup()
    const pov = (pct: number) =>
      order({ strategy_type: 'POV', parameters: [int('participation_pct', pct), int('max_pct', pct)] })
    const running = place(pov(40))
    change('POV_MAX_PARTICIPATION_PCT', 20)

    expect(() => place(pov(40))).toThrow('vượt trần hệ thống 20%')
    tick(1, 0, 0)
    tick(1, 0, 10_000)
    expect(engine.getChildren(running).map((child) => child.quantity)).toEqual([4_000])
  })
})
