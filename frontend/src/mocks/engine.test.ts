import { describe, expect, it } from 'vitest'
import type {
  CreateOrderRequest,
  MarketState,
  SessionCode,
  Side,
  StrategyParameter,
  StrategyType,
  SymbolQuote,
} from '@/types'
import { getSessionAt, isValidTick } from '@/utils/hose'
import {
  createOrderEngine,
  getTwapTarget,
  getVwapTarget,
  isChildLive,
  isConditionHit,
  type OrderEngine,
} from './engine'
import { createSeedData } from './seedOrders'
import { createMarketSimulator } from './simulator'

function seededRandom(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const hhmm = (hour: number, minute: number) => hour * 3600 + minute * 60
const AT_1000 = hhmm(10, 0)
const TODAY = '2026-11-06'

// Tham chiếu 100.000: trần 107.000, sàn 93.000, bước 100.
function quoteAt(last: number, totalVolume = 0): SymbolQuote {
  return {
    symbol: 'FPT',
    ref_price: 100_000,
    ceiling_price: 107_000,
    floor_price: 93_000,
    last_price: last,
    last_qty: 100,
    total_volume: totalVolume,
    bid_price: last - 100,
    ask_price: last + 100,
    tick_direction: 0,
  }
}

function marketAt(seconds: number, last = 100_000, totalVolume = 0, session?: SessionCode): MarketState {
  return {
    sim_seconds: seconds,
    session: session ?? getSessionAt(seconds),
    speed: 1,
    quotes: [quoteAt(last, totalVolume)],
  }
}

function newEngine(seed = 1) {
  const engine = createOrderEngine({ random: seededRandom(seed), getToday: () => TODAY })
  engine.onMarketTick(marketAt(AT_1000))
  return engine
}

function intParam(parameter_code: string, value: number): StrategyParameter {
  return { parameter_code, parameter_value: String(value), data_type: 'INTEGER' }
}

function timeParam(parameter_code: string, value: string): StrategyParameter {
  return { parameter_code, parameter_value: value, data_type: 'TIME' }
}

function request(
  strategy_type: StrategyType,
  parameters: StrategyParameter[],
  extra: Partial<CreateOrderRequest> = {},
): CreateOrderRequest {
  return {
    client_request_id: 'req',
    account_no: '058C123456',
    symbol: 'FPT',
    side: 'BUY',
    total_qty: 1_000,
    limit_price: null,
    strategy_type,
    persistence_mode: 'DAY',
    valid_to: null,
    parameters,
    ...extra,
  }
}

function place(engine: OrderEngine, ...args: Parameters<typeof request>) {
  return engine.createOrder(request(...args), 'tester').parent_order_id
}

/** Chạy nhiều nhịp ở một mức giá, mỗi nhịp cách nhau 1 giây. */
function run(engine: OrderEngine, ticks: number, last = 100_000, from = AT_1000) {
  for (let index = 1; index <= ticks; index += 1) {
    engine.onMarketTick(marketAt(from + index, last))
  }
}

const liveChildren = (engine: OrderEngine, id: string) =>
  engine.getChildren(id).filter((child) => isChildLive(child.status))

const ALL_STRATEGIES: Array<[StrategyType, StrategyParameter[], number | null, Side]> = [
  ['STOP', [intParam('trigger_price', 100_200)], null, 'BUY'],
  ['STOP_LIMIT', [intParam('trigger_price', 99_800)], 99_500, 'SELL'],
  ['TAKE_PROFIT', [intParam('trigger_price', 100_200)], 100_100, 'SELL'],
  ['TRAILING_STOP', [intParam('trailing_value', 300)], null, 'SELL'],
  ['OCO', [intParam('tp_price', 100_500), intParam('sl_price', 99_500)], null, 'SELL'],
  ['BRACKET', [intParam('tp_price', 100_500), intParam('sl_price', 99_500)], 100_000, 'BUY'],
  ['ICEBERG', [intParam('slice_qty', 300)], 100_500, 'BUY'],
  ['TWAP', [timeParam('start_time', '09:30'), timeParam('end_time', '14:00'), intParam('interval_min', 10)], 100_500, 'BUY'],
  ['VWAP', [timeParam('start_time', '09:30'), timeParam('end_time', '14:00')], 99_500, 'SELL'],
  ['POV', [intParam('participation_pct', 20), intParam('max_pct', 40)], 100_500, 'BUY'],
  ['HUNT', [intParam('hunt_price', 99_900), intParam('max_wait_min', 200)], 100_100, 'BUY'],
]

describe('không khớp vượt total_qty', () => {
  it('báo khớp quá lớn bị cắt về phần còn lại', () => {
    const engine = newEngine()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 1_000)], { limit_price: 90_000 })
    run(engine, 1)
    const child = engine.getChildren(id)[0]

    expect(engine.applyExecution({ child_order_id: child.child_order_id, exchange_match_id: 'M1', price: 100_000, qty: 999_999 })).toBe(true)
    expect(engine.getOrder(id).executed_qty).toBe(1_000)
    expect(engine.getExecutions(id)[0].qty).toBe(1_000)
    expect(engine.getOrder(id).status).toBe('COMPLETED')
  })

  it('lệnh đã đủ thì báo khớp thêm không được ghi nhận', () => {
    const engine = newEngine()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 1_000)], { limit_price: 90_000 })
    run(engine, 1)
    const child = engine.getChildren(id)[0]
    engine.applyExecution({ child_order_id: child.child_order_id, exchange_match_id: 'M1', price: 100_000, qty: 1_000 })

    expect(engine.applyExecution({ child_order_id: child.child_order_id, exchange_match_id: 'M2', price: 100_000, qty: 100 })).toBe(false)
    expect(engine.getOrder(id).executed_qty).toBe(1_000)
  })

  it.each([1, 2, 3])('cả 11 loại lệnh chạy hết nhiều ngày giả lập vẫn giữ đúng luật (seed %i)', (seed) => {
    const random = seededRandom(seed)
    const simulator = createMarketSimulator({
      random,
      symbols: [{ symbol: 'FPT', ref_price: 100_000 }],
    })
    const engine = createOrderEngine({ random, getToday: () => TODAY })
    simulator.setSpeed(60)
    const ids: string[] = []

    for (let day = 0; day < 6; day += 1) {
      engine.onMarketTick(simulator.getState())
      for (const [strategy, parameters, limit, side] of ALL_STRATEGIES) {
        ids.push(place(engine, strategy, parameters, { limit_price: limit, side, total_qty: 2_000 }))
      }
      while (simulator.getState().session !== 'CLOSED') {
        simulator.tick(1000)
        engine.onMarketTick(simulator.getState())
        for (const id of ids) {
          const order = engine.getOrder(id)
          const entryFilled = engine
            .getChildren(id)
            .filter((child) => child.side === order.side)
            .reduce((sum, child) => sum + child.filled_qty, 0)

          expect(order.executed_qty).toBeLessThanOrEqual(order.total_qty)
          expect(order.executed_qty).toBe(entryFilled)
          expect(order.executed_qty % 100).toBe(0)
          if (!['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(order.status)) {
            expect(engine.getAllowedQty(id)).toBeGreaterThanOrEqual(0)
          }
        }
      }
      simulator.tick(1000)
      engine.onMarketTick(simulator.getState())
      simulator.reset()
    }

    const matchIds = ids.flatMap((id) => engine.getExecutions(id).map((item) => item.exchange_match_id))
    expect(new Set(matchIds).size).toBe(matchIds.length)
    expect(matchIds.length).toBeGreaterThan(0)
    for (const id of ids) {
      for (const child of engine.getChildren(id)) {
        expect(child.filled_qty).toBeLessThanOrEqual(child.quantity)
        expect(child.quantity % 100).toBe(0)
        if (child.price !== null) expect(isValidTick(child.price)).toBe(true)
      }
    }
  })
})

describe('không khớp trùng', () => {
  it('cùng exchange_match_id gửi hai lần chỉ cộng một lần', () => {
    const engine = newEngine()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 1_000)], { limit_price: 90_000 })
    run(engine, 1)
    const child = engine.getChildren(id)[0]
    const report = { child_order_id: child.child_order_id, exchange_match_id: 'DUP', price: 100_000, qty: 200 }

    expect(engine.applyExecution(report)).toBe(true)
    expect(engine.applyExecution(report)).toBe(false)
    expect(engine.getOrder(id).executed_qty).toBe(200)
    expect(engine.getChildren(id)[0].filled_qty).toBe(200)
    expect(engine.getExecutions(id)).toHaveLength(1)
    expect(engine.getEvents(id).filter((event) => event.action === 'FILL')).toHaveLength(1)
  })

  it('mã khớp đã có trong dữ liệu nạp sẵn cũng bị bỏ qua', () => {
    const engine = newEngine()
    const seed = createSeedData(new Date(2026, 10, 6))
    engine.load(seed)
    const execution = seed.executions[0]
    const before = engine.getOrder(execution.parent_order_id).executed_qty

    expect(engine.applyExecution({ child_order_id: execution.child_order_id, exchange_match_id: execution.exchange_match_id, price: execution.price, qty: execution.qty })).toBe(false)
    expect(engine.getOrder(execution.parent_order_id).executed_qty).toBe(before)
  })

  it('lệnh con không tồn tại bị bỏ qua', () => {
    expect(newEngine().applyExecution({ child_order_id: 'X', exchange_match_id: 'M', price: 1, qty: 100 })).toBe(false)
  })
})

describe('allowed = total − executed − working', () => {
  it('lệnh con đang chờ làm giảm allowed, khớp một phần không tính hai lần', () => {
    const engine = newEngine()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 300)], { limit_price: 90_000 })
    expect(engine.getAllowedQty(id)).toBe(1_000)

    run(engine, 1)
    expect(engine.getWorkingQty(id)).toBe(300)
    expect(engine.getAllowedQty(id)).toBe(700)

    const child = engine.getChildren(id)[0]
    engine.applyExecution({ child_order_id: child.child_order_id, exchange_match_id: 'M1', price: 100_000, qty: 100 })
    expect(engine.getWorkingQty(id)).toBe(200)
    expect(engine.getAllowedQty(id)).toBe(700)
  })

  it('Child UNKNOWN vẫn là working và chặn sinh thêm cho tới khi đối soát', () => {
    const engine = newEngine()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 1_000)], { limit_price: 90_000 })
    run(engine, 2)
    const childId = engine.getChildren(id)[0].child_order_id
    engine.markChildUnknown(childId)

    expect(engine.getWorkingQty(id)).toBe(1_000)
    expect(engine.getAllowedQty(id)).toBe(0)
    run(engine, 5, 100_000, AT_1000 + 10)
    expect(engine.getChildren(id)).toHaveLength(1)

    engine.reconcileUnknownChild(childId)
    expect(engine.getWorkingQty(id)).toBe(0)
    run(engine, 1, 100_000, AT_1000 + 20)
    expect(liveChildren(engine, id)).toHaveLength(1)
    expect(engine.getEvents(id).map((event) => event.action)).toEqual(expect.arrayContaining(['CHILD_UNKNOWN', 'RECOVERY']))
  })

  it('Child UNKNOWN không bị khớp ở nhịp thường', () => {
    const engine = newEngine()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 500)], { limit_price: 100_500 })
    run(engine, 1)
    engine.markChildUnknown(engine.getChildren(id)[0].child_order_id)
    run(engine, 10, 100_000, AT_1000 + 10)
    expect(engine.getOrder(id).executed_qty).toBe(0)
  })
})

describe('kích hoạt theo giá', () => {
  it.each([
    ['STOP', 'BUY', 100_200, 100_200, true],
    ['STOP', 'BUY', 100_100, 100_200, false],
    ['STOP', 'SELL', 99_800, 99_800, true],
    ['STOP', 'SELL', 99_900, 99_800, false],
    ['TAKE_PROFIT', 'SELL', 100_500, 100_500, true],
    ['TAKE_PROFIT', 'SELL', 100_400, 100_500, false],
    ['TAKE_PROFIT', 'BUY', 99_500, 99_500, true],
    ['HUNT', 'BUY', 99_900, 99_900, true],
    ['HUNT', 'BUY', 100_000, 99_900, false],
    ['HUNT', 'SELL', 100_100, 100_100, true],
  ] as const)('%s %s giá %i trigger %i: %s', (type, side, last, trigger, expected) => {
    expect(isConditionHit(type, side, last, trigger)).toBe(expected)
  })

  it('Stop chưa chạm thì không sinh lệnh con; chạm thì sinh MTL và khớp', () => {
    const engine = newEngine()
    const id = place(engine, 'STOP', [intParam('trigger_price', 100_500)])
    run(engine, 5, 100_000)
    expect(engine.getChildren(id)).toHaveLength(0)
    expect(engine.getConditions(id)[0].status).toBe('ACTIVE')

    engine.onMarketTick(marketAt(AT_1000 + 10, 100_500))
    const child = engine.getChildren(id)[0]
    expect(child.order_type).toBe('MTL')
    expect(child.price).toBeNull()
    expect(child.quantity).toBe(1_000)
    expect(engine.getConditions(id)[0].status).toBe('TRIGGERED')
    expect(engine.getEvents(id).some((event) => event.action === 'TRIGGER')).toBe(true)

    run(engine, 30, 100_000, AT_1000 + 11)
    expect(engine.getOrder(id).status).toBe('COMPLETED')
  })

  it('Stop Limit và Take Profit sinh LO đúng giá giới hạn', () => {
    const engine = newEngine()
    const stopLimit = place(engine, 'STOP_LIMIT', [intParam('trigger_price', 100_000)], { limit_price: 100_200 })
    const takeProfit = place(engine, 'TAKE_PROFIT', [intParam('trigger_price', 100_000)], { limit_price: 100_000, side: 'SELL' })
    run(engine, 1)
    expect(engine.getChildren(stopLimit)[0]).toMatchObject({ order_type: 'LO', price: 100_200 })
    expect(engine.getChildren(takeProfit)[0]).toMatchObject({ order_type: 'LO', price: 100_000, side: 'SELL' })
  })

  it('Trailing bán: giá kích hoạt bám đỉnh, không tụt theo giá giảm', () => {
    const engine = newEngine()
    const id = place(engine, 'TRAILING_STOP', [intParam('trailing_value', 500)], { side: 'SELL' })
    engine.onMarketTick(marketAt(AT_1000 + 1, 100_000))
    expect(engine.getConditions(id)[0].trigger_price).toBe(99_500)
    engine.onMarketTick(marketAt(AT_1000 + 2, 101_000))
    expect(engine.getConditions(id)[0].trigger_price).toBe(100_500)
    engine.onMarketTick(marketAt(AT_1000 + 3, 100_600))
    expect(engine.getConditions(id)[0].trigger_price).toBe(100_500)
    expect(engine.getChildren(id)).toHaveLength(0)

    engine.onMarketTick(marketAt(AT_1000 + 4, 100_500))
    expect(engine.getChildren(id)[0].order_type).toBe('MTL')
  })

  it('OCO chạm TP: sinh LO giá TP, SL bị hủy', () => {
    const engine = newEngine()
    const id = place(engine, 'OCO', [intParam('tp_price', 100_500), intParam('sl_price', 99_500)], { side: 'SELL' })
    engine.onMarketTick(marketAt(AT_1000 + 1, 100_500))

    expect(engine.getChildren(id)[0]).toMatchObject({ order_type: 'LO', price: 100_500 })
    const [tp, sl] = engine.getConditions(id)
    expect(tp.status).toBe('TRIGGERED')
    expect(sl.status).toBe('CANCELLED')
  })

  it('OCO chạm SL: sinh MTL, TP bị hủy, và không kích hoạt lần hai', () => {
    const engine = newEngine()
    const id = place(engine, 'OCO', [intParam('tp_price', 100_500), intParam('sl_price', 99_500)], { side: 'SELL' })
    engine.onMarketTick(marketAt(AT_1000 + 1, 99_500))
    engine.onMarketTick(marketAt(AT_1000 + 2, 100_500))

    expect(engine.getChildren(id)).toHaveLength(1)
    expect(engine.getChildren(id)[0].order_type).toBe('MTL')
    const [tp, sl] = engine.getConditions(id)
    expect(tp.status).toBe('CANCELLED')
    expect(sl.status).toBe('TRIGGERED')
  })

  it('HUNT chờ quá hạn thì hết hạn, không sinh lệnh con', () => {
    const engine = newEngine()
    const id = place(engine, 'HUNT', [intParam('hunt_price', 99_000), intParam('max_wait_min', 5)], { limit_price: 99_200 })
    engine.onMarketTick(marketAt(AT_1000 + 299))
    expect(engine.getOrder(id).status).toBe('ACTIVE')
    engine.onMarketTick(marketAt(AT_1000 + 300))
    expect(engine.getOrder(id).status).toBe('EXPIRED')
    expect(engine.getChildren(id)).toHaveLength(0)
  })

  it('HUNT chạm giá săn thì sinh LO theo giá giới hạn', () => {
    const engine = newEngine()
    const id = place(engine, 'HUNT', [intParam('hunt_price', 99_000), intParam('max_wait_min', 5)], { limit_price: 99_200 })
    engine.onMarketTick(marketAt(AT_1000 + 1, 99_000))
    expect(engine.getChildren(id)[0]).toMatchObject({ order_type: 'LO', price: 99_200 })
  })
})

describe('Bracket', () => {
  it('khớp lệnh vào xong mới theo dõi TP/SL; lệnh thoát ngược chiều, không cộng vào executed', () => {
    const engine = newEngine()
    const id = place(engine, 'BRACKET', [intParam('tp_price', 100_500), intParam('sl_price', 99_500)], { limit_price: 100_000 })

    // Giá chạm TP khi chưa vào lệnh: chưa được kích hoạt.
    run(engine, 1, 100_000)
    expect(engine.getChildren(id)[0]).toMatchObject({ side: 'BUY', order_type: 'LO', price: 100_000 })
    run(engine, 40, 100_000, AT_1000 + 1)
    expect(engine.getOrder(id)).toMatchObject({ executed_qty: 1_000, status: 'PARTIALLY_EXECUTED' })

    engine.onMarketTick(marketAt(AT_1000 + 50, 100_500))
    const exit = engine.getChildren(id).find((child) => child.side === 'SELL')
    expect(exit).toMatchObject({ order_type: 'LO', price: 100_500, quantity: 1_000 })

    run(engine, 40, 100_500, AT_1000 + 51)
    expect(engine.getOrder(id)).toMatchObject({ executed_qty: 1_000, status: 'COMPLETED' })
  })

  it('chạm SL thì thoát bằng MTL', () => {
    const engine = newEngine()
    const id = place(engine, 'BRACKET', [intParam('tp_price', 100_500), intParam('sl_price', 99_500)], { limit_price: 100_000 })
    run(engine, 40, 100_000)
    engine.onMarketTick(marketAt(AT_1000 + 50, 99_500))
    expect(engine.getChildren(id).find((child) => child.side === 'SELL')?.order_type).toBe('MTL')
  })
})

describe('sinh lệnh con theo thuật toán', () => {
  it('Iceberg: mỗi lần một phần đúng slice_qty, phần trước xong mới có phần sau', () => {
    const engine = newEngine()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 300)], { limit_price: 100_500 })
    for (let index = 1; index < 80 && engine.getOrder(id).status !== 'COMPLETED'; index += 1) {
      engine.onMarketTick(marketAt(AT_1000 + index))
      expect(liveChildren(engine, id).length).toBeLessThanOrEqual(1)
    }
    expect(engine.getOrder(id)).toMatchObject({ executed_qty: 1_000, status: 'COMPLETED' })
    expect(engine.getChildren(id).map((child) => child.quantity)).toEqual([300, 300, 300, 100])
  })

  it('Iceberg giá chưa tới thì lệnh con đứng chờ', () => {
    const engine = newEngine()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 300)], { limit_price: 99_000 })
    run(engine, 20)
    expect(engine.getOrder(id).executed_qty).toBe(0)
    expect(engine.getChildren(id)).toHaveLength(1)
  })

  it('TWAP: lịch lũy kế chia đều theo chu kỳ, chu kỳ cuối bằng total', () => {
    expect(getTwapTarget(1_000, 3_600, 900, 0)).toBe(300)
    expect(getTwapTarget(1_000, 3_600, 900, 900)).toBe(500)
    expect(getTwapTarget(1_000, 3_600, 900, 1_800)).toBe(800)
    expect(getTwapTarget(1_000, 3_600, 900, 2_700)).toBe(1_000)
    expect(getTwapTarget(1_000, 3_600, 900, 99_999)).toBe(1_000)
  })

  it('TWAP: chờ đến giờ bắt đầu, mỗi interval mới sinh thêm', () => {
    const engine = newEngine()
    const id = place(
      engine,
      'TWAP',
      [timeParam('start_time', '10:30'), timeParam('end_time', '11:30'), intParam('interval_min', 15)],
      { limit_price: 100_500, total_qty: 4_000 },
    )
    engine.onMarketTick(marketAt(hhmm(10, 29)))
    expect(engine.getChildren(id)).toHaveLength(0)

    engine.onMarketTick(marketAt(hhmm(10, 30)))
    expect(engine.getChildren(id).map((child) => child.quantity)).toEqual([1_000])

    // Trong cùng chu kỳ không sinh thêm dù lệnh con đã khớp hết.
    for (let second = 1; second < 60; second += 1) engine.onMarketTick(marketAt(hhmm(10, 30) + second))
    expect(engine.getOrder(id).executed_qty).toBe(1_000)
    expect(engine.getChildren(id)).toHaveLength(1)

    engine.onMarketTick(marketAt(hhmm(10, 45)))
    expect(engine.getChildren(id).map((child) => child.quantity)).toEqual([1_000, 1_000])
  })

  it('TWAP hết khung giờ mà chưa đủ thì hết hạn, lệnh con đang chờ cũng hết hạn', () => {
    const engine = newEngine()
    const id = place(
      engine,
      'TWAP',
      [timeParam('start_time', '10:30'), timeParam('end_time', '11:00'), intParam('interval_min', 10)],
      { limit_price: 90_000 },
    )
    engine.onMarketTick(marketAt(hhmm(10, 30)))
    engine.onMarketTick(marketAt(hhmm(11, 0)))
    expect(engine.getOrder(id).status).toBe('EXPIRED')
    expect(liveChildren(engine, id)).toHaveLength(0)
  })

  it('VWAP: lịch lũy kế tăng dần, hai đầu khung giờ nhiều hơn ở giữa, kết thúc bằng total', () => {
    const window = 3_000
    const targets = Array.from({ length: 10 }, (_, index) => getVwapTarget(10_000, window, index * 300))
    const steps = targets.map((target, index) => target - (index === 0 ? 0 : targets[index - 1]))

    expect(targets.at(-1)).toBe(10_000)
    expect(steps.every((step) => step > 0 && step % 100 === 0)).toBe(true)
    expect(steps[0]).toBeGreaterThan(steps[4])
    expect(steps[9]).toBeGreaterThan(steps[5])
  })

  it('POV: sinh theo % KL thị trường, cộng dồn phần lẻ, không quá max %', () => {
    const engine = newEngine()
    const id = place(engine, 'POV', [intParam('participation_pct', 10), intParam('max_pct', 20)], { limit_price: 90_000, total_qty: 5_000 })
    const tick = (second: number, volume: number) => engine.onMarketTick(marketAt(AT_1000 + second, 100_000, volume))

    tick(1, 0)
    tick(2, 500) // 10% của 500 = 50: chưa đủ lô.
    expect(engine.getChildren(id)).toHaveLength(0)
    tick(3, 1_000) // Cộng dồn 100: đủ một lô.
    expect(engine.getChildren(id).map((child) => child.quantity)).toEqual([100])
    tick(4, 11_000) // 10% của 10.000 = 1.000.
    expect(engine.getChildren(id).map((child) => child.quantity)).toEqual([100, 1_000])
  })
})

describe('phiên giao dịch', () => {
  it.each([
    ['ATO', hhmm(9, 5)],
    ['nghỉ trưa', hhmm(12, 0)],
    ['ATC', hhmm(14, 35)],
  ])('%s: không sinh và không khớp lệnh con', (_, seconds) => {
    const engine = newEngine()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 300)], { limit_price: 100_500 })
    run(engine, 10, 100_000, seconds)
    expect(engine.getChildren(id)).toHaveLength(0)
    expect(engine.getOrder(id).executed_qty).toBe(0)
  })

  it('đóng cửa: lệnh DAY và lệnh con hết hạn', () => {
    const engine = newEngine()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 300)], { limit_price: 90_000 })
    run(engine, 2)
    engine.onMarketTick(marketAt(hhmm(14, 45)))
    expect(engine.getOrder(id).status).toBe('EXPIRED')
    expect(engine.getChildren(id)[0].status).toBe('EXPIRED')
  })

  it('đóng cửa: GTD chưa tới hạn vẫn sống, lệnh con hết hạn', () => {
    const engine = newEngine()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 300)], {
      limit_price: 90_000,
      persistence_mode: 'GTD',
      valid_to: '2026-11-20',
    })
    run(engine, 2)
    engine.onMarketTick(marketAt(hhmm(14, 45)))
    expect(engine.getOrder(id).status).toBe('ACTIVE')
    expect(engine.getChildren(id)[0].status).toBe('EXPIRED')
    expect(engine.getWorkingQty(id)).toBe(0)
  })
})

describe('thao tác của người dùng', () => {
  it('Tạm dừng hủy lệnh con đang chờ, không khớp thêm; Tiếp tục sinh lại phần còn lại', () => {
    const engine = newEngine()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 500)], { limit_price: 90_000 })
    run(engine, 2)
    engine.pauseOrder(id, 'tester')
    expect(engine.getOrder(id).status).toBe('PAUSED_USER')
    expect(liveChildren(engine, id)).toHaveLength(0)
    expect(engine.getAllowedQty(id)).toBe(1_000)

    run(engine, 5, 90_000, AT_1000 + 10)
    expect(engine.getChildren(id)).toHaveLength(1)
    expect(engine.getOrder(id).executed_qty).toBe(0)

    engine.resumeOrder(id, 'tester')
    expect(engine.getOrder(id).status).toBe('ACTIVE')
    run(engine, 1, 100_000, AT_1000 + 20)
    expect(liveChildren(engine, id)).toHaveLength(1)
  })

  it('Tiếp tục lệnh đã có khớp thì về PARTIALLY_EXECUTED', () => {
    const engine = newEngine()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 500)], { limit_price: 90_000 })
    run(engine, 2)
    engine.applyExecution({ child_order_id: engine.getChildren(id)[0].child_order_id, exchange_match_id: 'M1', price: 100_000, qty: 100 })
    engine.pauseOrder(id, 'tester')
    engine.resumeOrder(id, 'tester')
    expect(engine.getOrder(id).status).toBe('PARTIALLY_EXECUTED')
  })

  it('Tạm dừng giữ nguyên Child UNKNOWN', () => {
    const engine = newEngine()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 500)], { limit_price: 90_000 })
    run(engine, 2)
    engine.markChildUnknown(engine.getChildren(id)[0].child_order_id)
    engine.pauseOrder(id, 'tester')
    expect(engine.getChildren(id)[0].status).toBe('UNKNOWN')
    expect(engine.getWorkingQty(id)).toBe(500)
  })

  it('Hủy: lệnh con và điều kiện bị hủy, lệnh chuyển CANCELLED', () => {
    const engine = newEngine()
    const id = place(engine, 'OCO', [intParam('tp_price', 100_500), intParam('sl_price', 99_500)], { side: 'SELL' })
    engine.cancelOrder(id, 'tester')
    expect(engine.getOrder(id).status).toBe('CANCELLED')
    expect(engine.getConditions(id).every((item) => item.status === 'CANCELLED')).toBe(true)
  })

  it('Hủy khi còn Child UNKNOWN: giữ CANCEL_PENDING, nhịp sau đối soát rồi CANCELLED', () => {
    const engine = newEngine()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 500)], { limit_price: 90_000 })
    run(engine, 2)
    engine.markChildUnknown(engine.getChildren(id)[0].child_order_id)
    engine.cancelOrder(id, 'tester')
    expect(engine.getOrder(id).status).toBe('CANCEL_PENDING')

    run(engine, 1, 100_000, AT_1000 + 20)
    expect(engine.getOrder(id).status).toBe('CANCELLED')
    expect(engine.getEvents(id).some((event) => event.action === 'RECOVERY')).toBe(true)
  })

  it('Sửa: hủy lệnh con cũ, sinh lại theo giá trị mới, version tăng, có MODIFY', () => {
    const engine = newEngine()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 500)], { limit_price: 90_000 + 3_000 })
    run(engine, 2)
    engine.updateOrder(id, { version: 1, total_qty: 2_000, limit_price: 94_000 }, 'tester')

    expect(engine.getOrder(id)).toMatchObject({ total_qty: 2_000, limit_price: 94_000, version: 2 })
    expect(engine.getChildren(id)[0].status).toBe('CANCELLED')
    run(engine, 1, 100_000, AT_1000 + 10)
    expect(liveChildren(engine, id)[0]).toMatchObject({ price: 94_000, quantity: 500 })
    expect(engine.getEvents(id).some((event) => event.action === 'MODIFY')).toBe(true)
  })

  it('Sửa sai version thì từ chối', () => {
    const engine = newEngine()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 500)], { limit_price: 99_000 })
    engine.updateOrder(id, { version: 1, total_qty: 2_000, limit_price: 99_000 }, 'tester')
    expect(() => engine.updateOrder(id, { version: 1, total_qty: 3_000, limit_price: 99_000 }, 'tester')).toThrow('thay đổi ở nơi khác')
    expect(engine.getOrder(id).total_qty).toBe(2_000)
  })

  it('Sửa kiểm tra luật HOSE, không cho KL nhỏ hơn đã khớp cộng UNKNOWN', () => {
    const engine = newEngine()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 500)], { limit_price: 99_000 })
    run(engine, 2)
    const child = engine.getChildren(id)[0]
    engine.applyExecution({ child_order_id: child.child_order_id, exchange_match_id: 'M1', price: 99_000, qty: 200 })
    engine.markChildUnknown(child.child_order_id)

    const edit = (total_qty: number, limit_price: number) => engine.updateOrder(id, { version: 1, total_qty, limit_price }, 'tester')
    expect(() => edit(150, 99_000)).toThrow('bội số')
    expect(() => edit(1_000, 99_050)).toThrow('bước')
    expect(() => edit(1_000, 200_000)).toThrow('trần')
    expect(() => edit(400, 99_000)).toThrow('không được nhỏ hơn 500')
    expect(edit(500, 99_000).total_qty).toBe(500)
  })

  it('Sửa giảm KL về đúng phần đã khớp thì lệnh hoàn tất', () => {
    const engine = newEngine()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 500)], { limit_price: 99_000 })
    run(engine, 2)
    engine.applyExecution({ child_order_id: engine.getChildren(id)[0].child_order_id, exchange_match_id: 'M1', price: 99_000, qty: 200 })
    engine.updateOrder(id, { version: 1, total_qty: 200, limit_price: 99_000 }, 'tester')
    expect(engine.getOrder(id).status).toBe('COMPLETED')
  })

  it('Sửa Stop không đổi được giá giới hạn vì loại này không có giá', () => {
    const engine = newEngine()
    const id = place(engine, 'STOP', [intParam('trigger_price', 100_500)])
    engine.updateOrder(id, { version: 1, total_qty: 2_000, limit_price: 99_000 }, 'tester')
    expect(engine.getOrder(id).limit_price).toBeNull()
  })

  it('khóa Sửa và Hủy trong ATO và ATC, vẫn cho Tạm dừng', () => {
    const engine = newEngine()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 500)], { limit_price: 99_000 })
    engine.onMarketTick(marketAt(hhmm(14, 35)))
    expect(() => engine.cancelOrder(id, 'tester')).toThrow('ATC')
    expect(() => engine.updateOrder(id, { version: 1, total_qty: 500, limit_price: 99_000 }, 'tester')).toThrow('ATC')
    expect(engine.pauseOrder(id, 'tester').status).toBe('PAUSED_USER')
  })

  it('từ chối thao tác sai trạng thái và lệnh không tồn tại', () => {
    const engine = newEngine()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 500)], { limit_price: 99_000 })
    expect(() => engine.resumeOrder(id, 'tester')).toThrow('không cho phép')
    engine.cancelOrder(id, 'tester')
    expect(() => engine.pauseOrder(id, 'tester')).toThrow('không cho phép')
    expect(() => engine.cancelOrder('KHONG-CO', 'tester')).toThrow('Không tìm thấy')
  })
})

describe('nhật ký OrderEvent', () => {
  it('mọi lần đổi trạng thái của lệnh cha và lệnh con đều có event đúng giá trị mới', () => {
    const random = seededRandom(9)
    const simulator = createMarketSimulator({ random, symbols: [{ symbol: 'FPT', ref_price: 100_000 }] })
    const engine = createOrderEngine({ random, getToday: () => TODAY })
    simulator.setSpeed(60)
    engine.onMarketTick(simulator.getState())
    const ids = ALL_STRATEGIES.map(([strategy, parameters, limit, side]) =>
      place(engine, strategy, parameters, { limit_price: limit, side, total_qty: 2_000 }),
    )
    const lastStatus = new Map<string, string>()

    const verify = () => {
      for (const id of ids) {
        const events = engine.getEvents(id)
        const status = engine.getOrder(id).status
        if (lastStatus.get(id) !== status) {
          expect(events.some((event) => event.child_order_id === null && event.new_value === status)).toBe(true)
          lastStatus.set(id, status)
        }
        for (const child of engine.getChildren(id)) {
          if (lastStatus.get(child.child_order_id) !== child.status) {
            expect(events.some((event) => event.child_order_id === child.child_order_id && event.new_value === child.status)).toBe(true)
            lastStatus.set(child.child_order_id, child.status)
          }
        }
      }
    }

    verify()
    while (simulator.getState().session !== 'CLOSED') {
      simulator.tick(1000)
      engine.onMarketTick(simulator.getState())
      verify()
    }
    expect(lastStatus.size).toBeGreaterThan(ids.length)
  })

  it('event ghi đúng người thao tác và mã event không trùng', () => {
    const engine = newEngine()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 500)], { limit_price: 99_000 })
    engine.pauseOrder(id, 'dealer')
    const pause = engine.getEvents(id).find((event) => event.action === 'PAUSE')
    expect(pause).toMatchObject({ user_id: 'dealer', old_value: 'ACTIVE', new_value: 'PAUSED_USER', channel: 'WEB' })
    const eventIds = engine.getEvents(id).map((event) => event.event_id)
    expect(new Set(eventIds).size).toBe(eventIds.length)
  })

  it('tạo lệnh lưu arrival snapshot từ giá hiện tại', () => {
    const engine = newEngine()
    engine.onMarketTick(marketAt(AT_1000, 100_300))
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 500)], { limit_price: 99_000 })
    expect(engine.getSnapshot(id)).toMatchObject({ arrival_price: 100_300, arrival_bid: 100_200, arrival_ask: 100_400 })
  })
})

describe('lệnh mẫu', () => {
  const seed = createSeedData(new Date(2026, 10, 6))

  it('có 6–8 lệnh, nhiều trạng thái khác nhau, nhiều tài khoản', () => {
    expect(seed.orders.length).toBeGreaterThanOrEqual(6)
    expect(seed.orders.length).toBeLessThanOrEqual(8)
    expect(new Set(seed.orders.map((order) => order.status)).size).toBeGreaterThanOrEqual(6)
    expect(new Set(seed.orders.map((order) => order.account_no)).size).toBe(3)
  })

  it('không vi phạm luật lõi', () => {
    for (const order of seed.orders) {
      const children = seed.children.filter((child) => child.parent_order_id === order.parent_order_id)
      const filled = children.reduce((sum, child) => sum + child.filled_qty, 0)
      const fromExecutions = seed.executions
        .filter((item) => item.parent_order_id === order.parent_order_id)
        .reduce((sum, item) => sum + item.qty, 0)
      const working = children
        .filter((child) => isChildLive(child.status))
        .reduce((sum, child) => sum + child.quantity - child.filled_qty, 0)

      expect(order.executed_qty).toBe(filled)
      expect(order.executed_qty).toBe(fromExecutions)
      expect(order.total_qty - order.executed_qty - working).toBeGreaterThanOrEqual(0)
      expect(order.total_qty % 100).toBe(0)
      if (order.limit_price !== null) expect(isValidTick(order.limit_price)).toBe(true)
      expect(seed.events.some((event) => event.parent_order_id === order.parent_order_id && event.action === 'CREATE')).toBe(true)
    }
    const ids = seed.orders.map((order) => order.parent_order_id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('có Child UNKNOWN để demo, và lệnh ACTIVE chưa có khớp', () => {
    expect(seed.children.some((child) => child.status === 'UNKNOWN')).toBe(true)
    for (const order of seed.orders.filter((item) => item.status === 'ACTIVE')) {
      expect(order.executed_qty).toBe(0)
    }
  })

  it('engine nạp lệnh mẫu rồi chạy được, mã lệnh mới không trùng', () => {
    const engine = createOrderEngine({ random: seededRandom(1), getToday: () => '2026-11-06' })
    engine.load(seed)
    engine.onMarketTick({
      sim_seconds: AT_1000,
      session: 'CONTINUOUS',
      speed: 1,
      quotes: [{ ...quoteAt(27_500), symbol: 'HPG', ref_price: 27_500, ceiling_price: 29_400, floor_price: 25_600 }],
    })
    const iceberg = seed.orders.find((order) => order.symbol === 'HPG')
    expect(engine.getChildren(iceberg?.parent_order_id ?? '')).toHaveLength(1)

    const created = engine.createOrder(request('ICEBERG', [intParam('slice_qty', 100)], { limit_price: 27_500, symbol: 'HPG' }), 'tester')
    expect(seed.orders.map((order) => order.parent_order_id)).not.toContain(created.parent_order_id)
  })

  it('nạp lại thì lệnh đã đặt biến mất và dữ liệu mẫu gốc không bị đổi', () => {
    const engine = createOrderEngine({ random: seededRandom(1), getToday: () => '2026-11-06' })
    engine.load(seed)
    const before = seed.orders[0].status
    engine.onMarketTick({ sim_seconds: AT_1000, session: 'CONTINUOUS', speed: 1, quotes: [] })
    engine.cancelOrder(seed.orders[0].parent_order_id, 'tester')
    engine.createOrder(request('ICEBERG', [intParam('slice_qty', 100)]), 'tester')

    expect(seed.orders[0].status).toBe(before)
    engine.load(seed)
    expect(engine.listOrders()).toHaveLength(seed.orders.length)
    expect(engine.listOrders()[0].status).toBe(before)
  })
})
