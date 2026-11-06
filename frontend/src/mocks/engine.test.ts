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
import { getTwapTarget, getVwapTarget } from '@/utils/schedule'
import {
  createOrderEngine,
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
    indicative_price: null,
    last_qty: 100,
    total_volume: totalVolume,
    bid_price: last - 100,
    ask_price: last + 100,
    tick_direction: 0,
  }
}

function marketAt(
  seconds: number,
  last = 100_000,
  totalVolume = 0,
  session?: SessionCode,
  tradingDate = TODAY,
): MarketState {
  return {
    trading_date: tradingDate,
    sim_seconds: seconds,
    quote_age_seconds: 0,
    session: session ?? getSessionAt(seconds),
    speed: 1,
    quotes: [quoteAt(last, totalVolume)],
  }
}

function newEngine(seed = 1) {
  const engine = createOrderEngine({ random: seededRandom(seed) })
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
      startDate: new Date(2026, 10, 6),
      symbols: [{ symbol: 'FPT', ref_price: 100_000 }],
    })
    const engine = createOrderEngine({ random })
    simulator.setSpeed(60)
    const ids: string[] = []

    for (let day = 0; day < 3; day += 1) {
      engine.onMarketTick(simulator.getState())
      for (const [strategy, parameters, limit, side] of ALL_STRATEGIES) {
        ids.push(place(engine, strategy, parameters, { limit_price: limit, side, total_qty: 2_000 }))
        ids.push(
          place(engine, strategy, parameters, {
            limit_price: limit,
            side,
            total_qty: 2_000,
            persistence_mode: 'MULTI_SESSION',
            valid_to: '2026-12-31',
          }),
        )
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
      simulator.nextDay()
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
  }, 60_000)
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
  it('nghỉ trưa: không sinh và không khớp lệnh con', () => {
    const engine = newEngine()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 300)], { limit_price: 100_500 })
    run(engine, 10, 100_000, hhmm(12, 0))
    expect(engine.getChildren(id)).toHaveLength(0)
    expect(engine.getOrder(id).executed_qty).toBe(0)
  })
})

describe('khớp định kỳ ATO, ATC', () => {
  const OPEN_AUCTION = hhmm(9, 15)
  const CLOSE_AUCTION = hhmm(14, 45)

  function startInAto() {
    const engine = createOrderEngine({ random: seededRandom(1) })
    engine.onMarketTick(marketAt(hhmm(9, 10)))
    return engine
  }

  it.each([
    ['ATO', hhmm(9, 5)],
    ['ATC', hhmm(14, 35)],
  ])('trong %s: có gửi lệnh con nhưng chưa khớp dù đủ điều kiện giá', (_, seconds) => {
    const engine = newEngine()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 300)], { limit_price: 100_500 })
    run(engine, 10, 100_000, seconds)

    expect(engine.getChildren(id)).toHaveLength(1)
    expect(engine.getChildren(id)[0]).toMatchObject({ order_type: 'LO', status: 'ACKNOWLEDGED', filled_qty: 0 })
    expect(engine.getOrder(id).executed_qty).toBe(0)
    expect(engine.getExecutions(id)).toHaveLength(0)
  })

  it('09:15 khớp một lần tại giá định kỳ, khớp hết phần đủ điều kiện', () => {
    const engine = startInAto()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 700)], { limit_price: 100_500 })
    run(engine, 3, 100_000, hhmm(9, 10))

    engine.onMarketTick(marketAt(OPEN_AUCTION, 100_200))
    const executions = engine.getExecutions(id)
    expect(executions).toHaveLength(1)
    expect(executions[0]).toMatchObject({ price: 100_200, qty: 700 })
    expect(engine.getChildren(id)[0].status).toBe('FILLED')
    expect(engine.getOrder(id)).toMatchObject({ executed_qty: 700, status: 'PARTIALLY_EXECUTED' })
  })

  it('LO có giá kém hơn giá định kỳ thì không khớp, chờ tiếp ở phiên liên tục', () => {
    const engine = startInAto()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 700)], { limit_price: 99_000 })
    run(engine, 3, 100_000, hhmm(9, 10))

    engine.onMarketTick(marketAt(OPEN_AUCTION, 100_200))
    expect(engine.getExecutions(id)).toHaveLength(0)
    expect(engine.getChildren(id)[0].status).toBe('ACKNOWLEDGED')
    run(engine, 5, 100_200, OPEN_AUCTION)
    expect(engine.getExecutions(id)).toHaveLength(0)
    run(engine, 40, 98_900, OPEN_AUCTION + 10)
    expect(engine.getExecutions(id).length).toBeGreaterThan(0)
  })

  it('chỉ khớp định kỳ một lần: nhịp lặp lại ở cùng thời điểm không chạy lại', () => {
    const engine = startInAto()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 300)], { limit_price: 100_500 })
    run(engine, 2, 100_000, hhmm(9, 10))
    engine.onMarketTick(marketAt(OPEN_AUCTION, 100_000))
    expect(engine.getExecutions(id)).toHaveLength(1)
    expect(engine.getExecutions(id)[0].qty).toBe(300)

    // Không còn là nhịp chuyển phiên: chỉ khớp dần theo luật phiên liên tục, tối đa 500 CP mỗi nhịp.
    const other = place(engine, 'ICEBERG', [intParam('slice_qty', 1_000)], { limit_price: 100_500 })
    engine.onMarketTick(marketAt(OPEN_AUCTION + 1, 100_000))
    engine.onMarketTick(marketAt(OPEN_AUCTION + 2, 100_000))
    expect(engine.getExecutions(other)[0].qty).toBeLessThanOrEqual(500)
  })

  it('phát lại cùng thời điểm (đổi tốc độ) không tính là một nhịp mới', () => {
    const engine = startInAto()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 300)], { limit_price: 100_500 })
    run(engine, 2, 100_000, hhmm(9, 10))
    engine.onMarketTick(marketAt(OPEN_AUCTION, 100_000))
    const executions = engine.getExecutions(id).length
    const children = engine.getChildren(id).length

    engine.onMarketTick(marketAt(OPEN_AUCTION, 100_000))
    engine.onMarketTick(marketAt(OPEN_AUCTION, 100_000))
    expect(engine.getExecutions(id)).toHaveLength(executions)
    expect(engine.getChildren(id)).toHaveLength(children)
    expect(engine.getChildren(id).at(-1)?.status).toBe('CREATED')
  })

  it('Stop không kích hoạt bằng giá cũ trong ATO, chờ giá thật ở phiên liên tục', () => {
    const engine = startInAto()
    const id = place(engine, 'STOP', [intParam('trigger_price', 100_000)])
    run(engine, 3, 100_000, hhmm(9, 10))
    expect(engine.getConditions(id)[0].status).toBe('ACTIVE')
    expect(engine.getChildren(id)).toHaveLength(0)

    engine.onMarketTick(marketAt(OPEN_AUCTION, 100_000))
    expect(engine.getConditions(id)[0].status).toBe('TRIGGERED')
    expect(engine.getChildren(id)[0].order_type).toBe('MTL')
  })

  it('Stop đã kích hoạt, vào ATC: hủy MTL còn sót, sinh lệnh ATC, khớp đúng 14:45', () => {
    const engine = newEngine()
    const id = place(engine, 'STOP', [intParam('trigger_price', 100_000)])
    engine.onMarketTick(marketAt(hhmm(14, 29)))
    engine.onMarketTick(marketAt(hhmm(14, 29) + 1))
    expect(engine.getChildren(id)[0].order_type).toBe('MTL')
    const filledBefore = engine.getOrder(id).executed_qty
    expect(filledBefore).toBeLessThan(1_000)

    engine.onMarketTick(marketAt(hhmm(14, 30)))
    expect(engine.getChildren(id)[0].status).toBe('CANCELLED')
    const atc = engine.getChildren(id)[1]
    expect(atc).toMatchObject({ order_type: 'ATC', price: null, quantity: 1_000 - filledBefore })

    run(engine, 10, 100_000, hhmm(14, 31))
    expect(engine.getOrder(id).executed_qty).toBe(filledBefore)

    engine.onMarketTick(marketAt(CLOSE_AUCTION, 100_300))
    expect(engine.getChildren(id)[1].status).toBe('FILLED')
    expect(engine.getExecutions(id).at(-1)).toMatchObject({ price: 100_300, qty: 1_000 - filledBefore })
    expect(engine.getOrder(id)).toMatchObject({ executed_qty: 1_000, status: 'COMPLETED' })
  })

  it('Tiếp tục lệnh đã kích hoạt trong ATO: sinh lệnh ATO, khớp lúc 09:15', () => {
    const engine = newEngine()
    const id = place(engine, 'STOP', [intParam('trigger_price', 100_000)], {
      persistence_mode: 'MULTI_SESSION',
      valid_to: '2026-12-31',
    })
    run(engine, 1)
    engine.pauseOrder(id, 'tester')
    engine.onMarketTick(marketAt(hhmm(14, 45)))
    const nextDay = '2026-11-09'
    engine.onMarketTick(marketAt(hhmm(9, 10), 100_000, 0, undefined, nextDay))
    engine.resumeOrder(id, 'tester')
    engine.onMarketTick(marketAt(hhmm(9, 11), 100_000, 0, undefined, nextDay))
    expect(engine.getChildren(id).at(-1)).toMatchObject({ order_type: 'ATO', price: null })

    engine.onMarketTick(marketAt(hhmm(9, 12), 100_000, 0, undefined, nextDay))
    engine.onMarketTick(marketAt(OPEN_AUCTION, 100_400, 0, undefined, nextDay))
    expect(engine.getChildren(id).at(-1)?.status).toBe('FILLED')
    expect(engine.getExecutions(id).at(-1)?.price).toBe(100_400)
  })

  it('ATC: khớp trước, phần còn lại của lệnh DAY mới hết hạn', () => {
    const engine = newEngine()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 300)], { limit_price: 100_500 })
    engine.onMarketTick(marketAt(hhmm(14, 35)))
    engine.onMarketTick(marketAt(hhmm(14, 36)))
    engine.onMarketTick(marketAt(CLOSE_AUCTION, 100_100))

    expect(engine.getOrder(id)).toMatchObject({ executed_qty: 300, status: 'EXPIRED' })
    expect(engine.getExecutions(id)).toHaveLength(1)
    expect(engine.getExecutions(id)[0]).toMatchObject({ price: 100_100, qty: 300 })
  })

  it('lệnh tạm dừng và Child UNKNOWN không tham gia khớp định kỳ', () => {
    const engine = startInAto()
    const paused = place(engine, 'ICEBERG', [intParam('slice_qty', 300)], { limit_price: 100_500 })
    const unknown = place(engine, 'ICEBERG', [intParam('slice_qty', 300)], { limit_price: 100_500 })
    run(engine, 2, 100_000, hhmm(9, 10))
    engine.pauseOrder(paused, 'tester')
    engine.markChildUnknown(engine.getChildren(unknown)[0].child_order_id)

    engine.onMarketTick(marketAt(OPEN_AUCTION, 100_000))
    expect(engine.getExecutions(paused)).toHaveLength(0)
    expect(engine.getExecutions(unknown)).toHaveLength(0)
    expect(engine.getChildren(unknown)[0].status).toBe('UNKNOWN')
  })

  it('khớp định kỳ không vượt total và không trùng mã khớp', () => {
    const engine = startInAto()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 1_000)], { limit_price: 100_500 })
    const other = place(engine, 'ICEBERG', [intParam('slice_qty', 1_000)], { limit_price: 100_500 })
    run(engine, 2, 100_000, hhmm(9, 10))
    engine.onMarketTick(marketAt(OPEN_AUCTION, 100_000))

    expect(engine.getOrder(id)).toMatchObject({ executed_qty: 1_000, status: 'COMPLETED' })
    const ids = [...engine.getExecutions(id), ...engine.getExecutions(other)].map((item) => item.exchange_match_id)
    expect(new Set(ids).size).toBe(2)
  })

  it('nạp lại trạng thái giữa ATO vẫn khớp định kỳ đúng lúc', () => {
    const engine = startInAto()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 300)], { limit_price: 100_500 })
    run(engine, 2, 100_000, hhmm(9, 10))

    const restored = createOrderEngine({ random: seededRandom(2) })
    restored.importState(JSON.parse(JSON.stringify(engine.exportState())))
    restored.onMarketTick(marketAt(OPEN_AUCTION, 100_000))
    expect(restored.getExecutions(id)).toHaveLength(1)
  })
})

describe('đầu ngày mới: giá giới hạn của lệnh mang sang', () => {
  const NEXT_DAY = '2026-11-09'
  const CLOSE = hhmm(14, 45)
  const LONG_TERM = { persistence_mode: 'MULTI_SESSION', valid_to: '2026-12-31' } as const

  /** Ngày mới có tham chiếu 80.000: trần 85.600, sàn 74.400. */
  function newDayMarket(seconds = hhmm(9, 10)): MarketState {
    return {
      ...marketAt(seconds, 80_000, 0, undefined, NEXT_DAY),
      quotes: [{ ...quoteAt(80_000), ref_price: 80_000, ceiling_price: 85_600, floor_price: 74_400 }],
    }
  }

  function carried(extra: Partial<CreateOrderRequest> = {}) {
    const engine = newEngine()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 300)], { limit_price: 94_000, ...LONG_TERM, ...extra })
    run(engine, 2)
    engine.onMarketTick(marketAt(CLOSE))
    return { engine, id }
  }

  it('ngoài biên độ: PAUSED_SYSTEM, có OrderEvent và Notification lý do, không sinh lệnh con', () => {
    const { engine, id } = carried()
    const childrenBefore = engine.getChildren(id).length

    engine.onMarketTick(newDayMarket())
    engine.onMarketTick(newDayMarket(hhmm(9, 11)))
    engine.onMarketTick(newDayMarket(hhmm(10, 0)))

    expect(engine.getOrder(id).status).toBe('PAUSED_SYSTEM')
    expect(engine.getChildren(id)).toHaveLength(childrenBefore)
    expect(engine.getWorkingQty(id)).toBe(0)

    const events = engine.getEvents(id)
    expect(events.find((event) => event.action === 'PAUSE')).toMatchObject({
      old_value: 'ACTIVE',
      new_value: 'PAUSED_SYSTEM',
      user_id: 'SYSTEM',
    })
    expect(events.find((event) => event.new_value?.startsWith('PRICE_OUT_OF_BAND'))).toMatchObject({
      action: 'DECISION',
      old_value: 'limit_price=94000',
      new_value: 'PRICE_OUT_OF_BAND:floor=74400,ceiling=85600',
    })
    expect(engine.getOrder(id).reason_code).toBe('PRICE_OUT_OF_BAND')

    const notifications = engine.getNotifications(id)
    expect(notifications).toHaveLength(1)
    expect(notifications[0].notification_type).toBe('PARENT_PAUSED')
    expect(notifications[0].message).toContain('94.000')
    expect(notifications[0].message).toContain('sàn 74.400')
    expect(notifications[0].message).toContain('trần 85.600')
    expect(notifications[0].sent_at.startsWith(NEXT_DAY)).toBe(true)
  })

  it('giá thấp hơn sàn mới cũng bị tạm dừng, đúng bằng trần hoặc sàn thì vẫn chạy', () => {
    const below = carried({ limit_price: 93_000 })
    below.engine.onMarketTick({ ...newDayMarket(), quotes: [{ ...quoteAt(100_000), floor_price: 93_100 }] })
    expect(below.engine.getOrder(below.id).status).toBe('PAUSED_SYSTEM')

    const atFloor = carried({ limit_price: 93_100 })
    atFloor.engine.onMarketTick({ ...newDayMarket(), quotes: [{ ...quoteAt(100_000), floor_price: 93_100 }] })
    expect(atFloor.engine.getOrder(atFloor.id).status).toBe('ACTIVE')

    const atCeiling = carried({ limit_price: 94_000 })
    atCeiling.engine.onMarketTick({ ...newDayMarket(), quotes: [{ ...quoteAt(100_000), ceiling_price: 94_000 }] })
    expect(atCeiling.engine.getOrder(atCeiling.id).status).toBe('ACTIVE')
    expect(atCeiling.engine.getNotifications(atCeiling.id)).toHaveLength(0)
  })

  it('trong biên độ: chạy bình thường, không có thông báo', () => {
    const { engine, id } = carried()
    engine.onMarketTick(marketAt(hhmm(10, 0), 100_000, 0, undefined, NEXT_DAY))
    expect(engine.getOrder(id).status).toBe('ACTIVE')
    expect(engine.getNotifications(id)).toHaveLength(0)
    expect(engine.getChildren(id).at(-1)?.status).toBe('CREATED')
  })

  describe('kiểm tra cả trigger, TP, SL', () => {
    function carriedWith(...args: Parameters<typeof request>) {
      const engine = newEngine()
      const id = place(engine, args[0], args[1], { ...LONG_TERM, ...args[2] })
      engine.onMarketTick(marketAt(CLOSE))
      return { engine, id }
    }
    /** Biên độ ngày mới truyền vào: chỉ đổi trần, sàn, giá khớp vẫn nằm giữa. */
    const dayWithBand = (floor: number, ceiling: number): MarketState => ({
      ...newDayMarket(),
      quotes: [{ ...quoteAt(100_000), floor_price: floor, ceiling_price: ceiling }],
    })

    it('Stop: trigger_price ngoài biên độ thì tạm dừng, không sinh lệnh con, báo đúng giá', () => {
      const { engine, id } = carriedWith('STOP', [intParam('trigger_price', 100_500)])
      engine.onMarketTick(newDayMarket())

      expect(engine.getOrder(id)).toMatchObject({ status: 'PAUSED_SYSTEM', reason_code: 'PRICE_OUT_OF_BAND' })
      expect(engine.getChildren(id)).toHaveLength(0)
      expect(engine.getEvents(id).some((event) => event.old_value === 'trigger_price=100500')).toBe(true)
      expect(engine.getNotifications(id)[0].message).toContain('Giá kích hoạt 100.500')
    })

    it('OCO: chỉ TP ngoài biên độ cũng tạm dừng', () => {
      const { engine, id } = carriedWith('OCO', [intParam('tp_price', 106_000), intParam('sl_price', 96_000)], { side: 'SELL' })
      engine.onMarketTick(dayWithBand(95_000, 105_000))
      expect(engine.getOrder(id).status).toBe('PAUSED_SYSTEM')
      expect(engine.getEvents(id).some((event) => event.old_value === 'tp_price=106000')).toBe(true)
    })

    it('OCO: chỉ SL ngoài biên độ cũng tạm dừng', () => {
      const { engine, id } = carriedWith('OCO', [intParam('tp_price', 104_000), intParam('sl_price', 94_000)], { side: 'SELL' })
      engine.onMarketTick(dayWithBand(95_000, 105_000))
      expect(engine.getOrder(id).status).toBe('PAUSED_SYSTEM')
      expect(engine.getEvents(id).some((event) => event.old_value === 'sl_price=94000')).toBe(true)
    })

    it('OCO: cả hai ngoài biên độ thì báo cả hai giá', () => {
      const { engine, id } = carriedWith('OCO', [intParam('tp_price', 106_000), intParam('sl_price', 94_000)], { side: 'SELL' })
      engine.onMarketTick(dayWithBand(95_000, 105_000))
      expect(engine.getEvents(id).some((event) => event.old_value === 'tp_price=106000,sl_price=94000')).toBe(true)
      expect(engine.getNotifications(id)[0].message).toContain('Giá chốt lời (TP) 106.000, Giá cắt lỗ (SL) 94.000')
    })

    it('OCO, HUNT: mọi giá trong biên độ thì chạy bình thường', () => {
      const oco = carriedWith('OCO', [intParam('tp_price', 104_000), intParam('sl_price', 96_000)], { side: 'SELL' })
      oco.engine.onMarketTick(dayWithBand(95_000, 105_000))
      expect(oco.engine.getOrder(oco.id).status).toBe('ACTIVE')

      const hunt = carriedWith('HUNT', [intParam('hunt_price', 99_000), intParam('max_wait_min', 5_000)], { limit_price: 99_200 })
      hunt.engine.onMarketTick(dayWithBand(95_000, 105_000))
      expect(hunt.engine.getOrder(hunt.id).status).toBe('ACTIVE')
    })

    it('HUNT: giá săn ngoài biên độ cũng tạm dừng', () => {
      const { engine, id } = carriedWith('HUNT', [intParam('hunt_price', 94_000), intParam('max_wait_min', 5_000)], { limit_price: 96_000 })
      engine.onMarketTick(dayWithBand(95_000, 105_000))
      expect(engine.getOrder(id).status).toBe('PAUSED_SYSTEM')
    })

    it('Trailing Stop không bị xét: giá kích hoạt do engine tính, bám theo thị trường', () => {
      const { engine, id } = carriedWith('TRAILING_STOP', [intParam('trailing_value', 500)])
      engine.onMarketTick(newDayMarket())
      expect(engine.getOrder(id).status).toBe('ACTIVE')
    })

    it('Stop đã kích hoạt: trigger_price hết tác dụng nên không bị xét', () => {
      const engine = newEngine()
      const id = place(engine, 'STOP', [intParam('trigger_price', 100_000)], { ...LONG_TERM, total_qty: 100_000 })
      run(engine, 2)
      expect(engine.getConditions(id)[0].status).toBe('TRIGGERED')
      engine.onMarketTick(marketAt(CLOSE))
      engine.onMarketTick(newDayMarket())
      expect(engine.getOrder(id).status).not.toBe('PAUSED_SYSTEM')
    })

    it('OCO đã kích hoạt SL: lệnh con là MTL, TP đã hủy, không xét giá nào nữa', () => {
      const engine = newEngine()
      const id = place(engine, 'OCO', [intParam('tp_price', 100_500), intParam('sl_price', 99_500)], { ...LONG_TERM, side: 'SELL', total_qty: 100_000 })
      engine.onMarketTick(marketAt(AT_1000 + 1, 99_500))
      engine.onMarketTick(marketAt(CLOSE))
      engine.onMarketTick(newDayMarket())
      expect(engine.getOrder(id).status).not.toBe('PAUSED_SYSTEM')
    })

    it('OCO đã kích hoạt TP: lệnh con LO đặt đúng giá TP nên vẫn bị xét', () => {
      const engine = newEngine()
      const id = place(engine, 'OCO', [intParam('tp_price', 100_500), intParam('sl_price', 99_500)], { ...LONG_TERM, side: 'SELL', total_qty: 100_000 })
      engine.onMarketTick(marketAt(AT_1000 + 1, 100_500))
      engine.onMarketTick(marketAt(CLOSE))
      engine.onMarketTick(newDayMarket())
      expect(engine.getOrder(id).status).toBe('PAUSED_SYSTEM')
      expect(engine.getEvents(id).some((event) => event.old_value === 'tp_price=100500')).toBe(true)
    })
  })

  it('lệnh đang tạm dừng bởi người dùng cũng chuyển PAUSED_SYSTEM, không Tiếp tục được', () => {
    const engine = newEngine()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 300)], { limit_price: 94_000, ...LONG_TERM })
    engine.pauseOrder(id, 'tester')
    engine.onMarketTick(marketAt(CLOSE))
    engine.onMarketTick(newDayMarket())

    expect(engine.getOrder(id).status).toBe('PAUSED_SYSTEM')
    expect(() => engine.resumeOrder(id, 'tester')).toThrow('không cho phép')
    expect(() => engine.cancelOrder(id, 'tester')).toThrow('ATO')
    engine.onMarketTick(newDayMarket(hhmm(10, 0)))
    expect(engine.cancelOrder(id, 'tester').status).toBe('CANCELLED')
  })

  it('lệnh đã PAUSED_SYSTEM từ trước không báo lặp lại', () => {
    const { engine, id } = carried()
    engine.onMarketTick(newDayMarket())
    engine.onMarketTick(marketAt(CLOSE, 80_000, 0, undefined, NEXT_DAY))
    engine.onMarketTick({ ...newDayMarket(), trading_date: '2026-11-10' })
    expect(engine.getNotifications(id)).toHaveLength(1)
  })

  describe('Bracket', () => {
    function entered() {
      const engine = newEngine()
      const id = place(engine, 'BRACKET', [intParam('tp_price', 100_500), intParam('sl_price', 99_500)], {
        limit_price: 100_000,
        ...LONG_TERM,
      })
      run(engine, 40, 100_000)
      expect(engine.getOrder(id).executed_qty).toBe(1_000)
      return { engine, id }
    }

    it('đã vào đủ: giá giới hạn không bị xét, TP và SL vẫn bị xét', () => {
      const { engine, id } = entered()
      engine.onMarketTick(marketAt(CLOSE))
      engine.onMarketTick(newDayMarket())
      expect(engine.getOrder(id).status).toBe('PAUSED_SYSTEM')
      const reason = engine.getEvents(id).find((event) => event.new_value?.startsWith('PRICE_OUT_OF_BAND'))
      expect(reason?.old_value).toBe('tp_price=100500,sl_price=99500')
    })

    it('đã thoát bằng SL: không còn giá nào bị xét', () => {
      const { engine, id } = entered()
      engine.onMarketTick(marketAt(AT_1000 + 50, 99_500))
      engine.onMarketTick(marketAt(CLOSE))
      engine.onMarketTick(newDayMarket())
      expect(engine.getOrder(id).status).not.toBe('PAUSED_SYSTEM')
    })
  })

  it('cùng một ngày thì không xét, sau khi nạp lại vẫn nhận ra ngày mới', () => {
    const { engine, id } = carried()
    const restored = createOrderEngine({ random: seededRandom(3) })
    restored.importState(JSON.parse(JSON.stringify(engine.exportState())))
    restored.onMarketTick({ ...newDayMarket(), trading_date: TODAY })
    expect(restored.getOrder(id).status).toBe('ACTIVE')
    restored.onMarketTick(newDayMarket())
    expect(restored.getOrder(id).status).toBe('PAUSED_SYSTEM')
    expect(restored.exportState().notifications).toHaveLength(1)
  })
})

describe('hết hạn theo persistence_mode', () => {
  const CLOSE = hhmm(14, 45)
  const NEXT_DAY = '2026-11-09'
  const closeOn = (engine: OrderEngine, date = TODAY) =>
    engine.onMarketTick(marketAt(CLOSE, 100_000, 0, undefined, date))
  const tickOn = (engine: OrderEngine, date: string, offset = 0, last = 100_000, volume = 0) =>
    engine.onMarketTick(marketAt(AT_1000 + offset, last, volume, undefined, date))
  const carryEvents = (engine: OrderEngine, id: string) =>
    engine.getEvents(id).filter((event) => event.new_value?.startsWith('CARRY_OVER'))

  /** Iceberg đã khớp 200/1.000, còn một lệnh con đang chờ. */
  function partlyFilled(engine: OrderEngine, extra: Partial<CreateOrderRequest>) {
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 500)], { limit_price: 94_000, ...extra })
    run(engine, 2)
    engine.applyExecution({
      child_order_id: engine.getChildren(id)[0].child_order_id,
      exchange_match_id: `M-${id}`,
      price: 94_000,
      qty: 200,
    })
    return id
  }

  it('DAY: cuối phiên hết hạn, lệnh con hết hạn, không mang sang ngày sau', () => {
    const engine = newEngine()
    const id = partlyFilled(engine, { persistence_mode: 'DAY' })
    closeOn(engine)

    expect(engine.getOrder(id)).toMatchObject({ status: 'EXPIRED', executed_qty: 200 })
    expect(engine.getChildren(id)[0].status).toBe('EXPIRED')
    expect(carryEvents(engine, id)).toHaveLength(0)

    tickOn(engine, NEXT_DAY)
    expect(engine.getChildren(id)).toHaveLength(1)
  })

  it('GTD: chưa tới valid_to thì mang phần còn lại sang phiên sau, tới valid_to thì hết hạn', () => {
    const engine = newEngine()
    const id = partlyFilled(engine, { persistence_mode: 'GTD', valid_to: NEXT_DAY })
    closeOn(engine)

    expect(engine.getOrder(id)).toMatchObject({ status: 'PARTIALLY_EXECUTED', executed_qty: 200 })
    expect(engine.getChildren(id)[0].status).toBe('EXPIRED')
    expect(engine.getWorkingQty(id)).toBe(0)
    expect(engine.getAllowedQty(id)).toBe(800)
    expect(carryEvents(engine, id)).toHaveLength(1)

    tickOn(engine, NEXT_DAY)
    const carried = liveChildren(engine, id)
    expect(carried).toHaveLength(1)
    expect(carried[0].created_at.startsWith(NEXT_DAY)).toBe(true)
    expect(engine.getAllowedQty(id)).toBe(300)

    closeOn(engine, NEXT_DAY)
    expect(engine.getOrder(id).status).toBe('EXPIRED')
    expect(carryEvents(engine, id)).toHaveLength(1)
  })

  it('MULTI_SESSION: mang phần còn lại sang phiên sau, ghi OrderEvent đúng phần còn lại', () => {
    const engine = newEngine()
    const id = partlyFilled(engine, { persistence_mode: 'MULTI_SESSION', valid_to: '2026-12-31' })
    closeOn(engine)

    expect(engine.getOrder(id)).toMatchObject({ status: 'PARTIALLY_EXECUTED', executed_qty: 200 })
    expect(carryEvents(engine, id)[0]).toMatchObject({
      action: 'DECISION',
      old_value: `SESSION:${TODAY}`,
      new_value: 'CARRY_OVER:800',
      user_id: 'SYSTEM',
    })

    tickOn(engine, NEXT_DAY)
    expect(liveChildren(engine, id)[0]).toMatchObject({ quantity: 500, price: 94_000 })

    closeOn(engine, NEXT_DAY)
    expect(engine.getOrder(id).status).toBe('PARTIALLY_EXECUTED')
    expect(carryEvents(engine, id)).toHaveLength(2)
  })

  it('đồng hồ đứng ở giờ đóng cửa nhiều nhịp thì chỉ mang sang một lần', () => {
    const engine = newEngine()
    const id = partlyFilled(engine, { persistence_mode: 'MULTI_SESSION', valid_to: '2026-12-31' })
    for (let index = 0; index < 5; index += 1) closeOn(engine)
    expect(carryEvents(engine, id)).toHaveLength(1)
  })

  it('Child UNKNOWN được giữ lại qua đêm và vẫn tính là working', () => {
    const engine = newEngine()
    const id = partlyFilled(engine, { persistence_mode: 'MULTI_SESSION', valid_to: '2026-12-31' })
    engine.markChildUnknown(engine.getChildren(id)[0].child_order_id)
    closeOn(engine)

    expect(engine.getChildren(id)[0].status).toBe('UNKNOWN')
    expect(engine.getWorkingQty(id)).toBe(300)
    expect(engine.getAllowedQty(id)).toBe(500)
  })

  it('lệnh đang tạm dừng vẫn được mang sang và giữ nguyên tạm dừng', () => {
    const engine = newEngine()
    const id = partlyFilled(engine, { persistence_mode: 'GTD', valid_to: '2026-12-31' })
    engine.pauseOrder(id, 'tester')
    closeOn(engine)
    tickOn(engine, NEXT_DAY)

    expect(engine.getOrder(id).status).toBe('PAUSED_USER')
    expect(liveChildren(engine, id)).toHaveLength(0)
    expect(carryEvents(engine, id)).toHaveLength(1)
  })

  it('TWAP nhiều phiên: hết khung giờ không hết hạn, phiên sau chia lịch mới theo phần còn lại', () => {
    const engine = newEngine()
    const id = place(
      engine,
      'TWAP',
      [timeParam('start_time', '10:30'), timeParam('end_time', '11:00'), intParam('interval_min', 15)],
      { limit_price: 94_000, total_qty: 2_000, persistence_mode: 'MULTI_SESSION', valid_to: '2026-12-31' },
    )
    engine.onMarketTick(marketAt(hhmm(10, 30)))
    const firstChild = engine.getChildren(id)[0]
    expect(firstChild.quantity).toBe(1_000)
    engine.applyExecution({ child_order_id: firstChild.child_order_id, exchange_match_id: 'M-T1', price: 94_000, qty: 400 })

    engine.onMarketTick(marketAt(hhmm(11, 0)))
    expect(engine.getOrder(id).status).toBe('PARTIALLY_EXECUTED')
    expect(liveChildren(engine, id)).toHaveLength(0)

    closeOn(engine)
    engine.onMarketTick(marketAt(hhmm(10, 30), 100_000, 0, undefined, NEXT_DAY))
    // Còn 1.600, chia 2 chu kỳ: chu kỳ đầu 800, không phải bù một lần lên lịch cũ.
    expect(liveChildren(engine, id)[0].quantity).toBe(800)
  })

  it('TWAP trong ngày: hết khung giờ thì hết hạn ngay', () => {
    const engine = newEngine()
    const id = place(
      engine,
      'TWAP',
      [timeParam('start_time', '10:30'), timeParam('end_time', '11:00'), intParam('interval_min', 15)],
      { limit_price: 90_000 },
    )
    engine.onMarketTick(marketAt(hhmm(11, 0)))
    expect(engine.getOrder(id).status).toBe('EXPIRED')
  })

  it('POV nhiều phiên: KL thị trường đếm lại từ 0 vào ngày mới không làm hỏng phép tính', () => {
    const engine = newEngine()
    const id = place(engine, 'POV', [intParam('participation_pct', 10), intParam('max_pct', 20)], {
      limit_price: 94_000,
      total_qty: 5_000,
      persistence_mode: 'MULTI_SESSION',
      valid_to: '2026-12-31',
    })
    engine.onMarketTick(marketAt(AT_1000 + 1, 100_000, 50_000))
    closeOn(engine)
    tickOn(engine, NEXT_DAY, 1, 100_000, 0)
    tickOn(engine, NEXT_DAY, 2, 100_000, 2_000)
    expect(liveChildren(engine, id).map((child) => child.quantity)).toEqual([200])
  })

  it('HUNT nhiều phiên: hạn chờ tính liên tục qua ngày', () => {
    const engine = newEngine()
    const id = place(engine, 'HUNT', [intParam('hunt_price', 99_000), intParam('max_wait_min', 60 * 24 + 10)], {
      limit_price: 99_200,
      persistence_mode: 'MULTI_SESSION',
      valid_to: '2026-12-31',
    })
    closeOn(engine)
    tickOn(engine, NEXT_DAY, 0)
    expect(engine.getOrder(id).status).toBe('ACTIVE')
    tickOn(engine, NEXT_DAY, 600)
    expect(engine.getOrder(id).status).toBe('EXPIRED')
  })
})

describe('sửa giá lệnh PAUSED_SYSTEM do giá ngoài biên độ', () => {
  const NEXT_DAY = '2026-11-09'
  const CLOSE = hhmm(14, 45)
  const LONG_TERM = { persistence_mode: 'MULTI_SESSION', valid_to: '2026-12-31' } as const
  const AFTER_OPEN = hhmm(10, 0)

  /** Ngày mới tham chiếu 80.000: trần 85.600, sàn 74.400, bước 100. */
  function day2(seconds: number, last = 80_000): MarketState {
    return {
      ...marketAt(seconds, last, 0, undefined, NEXT_DAY),
      quotes: [{ ...quoteAt(last), ref_price: 80_000, ceiling_price: 85_600, floor_price: 74_400 }],
    }
  }

  /** Đưa lệnh tới trạng thái bị tạm dừng, đang ở phiên liên tục của ngày mới. */
  function pausedOrder(...args: Parameters<typeof request>) {
    const engine = newEngine()
    const id = place(engine, args[0], args[1], { ...LONG_TERM, ...args[2] })
    engine.onMarketTick(marketAt(CLOSE))
    engine.onMarketTick(day2(hhmm(9, 10)))
    engine.onMarketTick(day2(AFTER_OPEN))
    expect(engine.getOrder(id).status).toBe('PAUSED_SYSTEM')
    return { engine, id }
  }

  const iceberg = () => pausedOrder('ICEBERG', [intParam('slice_qty', 300)], { limit_price: 94_000 })
  const actionsOf = (engine: OrderEngine, id: string) => engine.getEvents(id).map((event) => event.action)

  it('giá hợp lệ: chuyển lại ACTIVE, xóa lý do, tăng version, ghi MODIFY và RESUME', () => {
    const { engine, id } = iceberg()
    const order = engine.repriceOrder(id, { version: 1, prices: { limit_price: 80_000 } }, 'dealer')

    expect(order).toMatchObject({ status: 'ACTIVE', limit_price: 80_000, reason_code: null, version: 2 })
    const events = engine.getEvents(id)
    expect(events.find((event) => event.action === 'MODIFY')).toMatchObject({
      user_id: 'dealer',
      old_value: JSON.stringify({ limit_price: 94_000 }),
      new_value: JSON.stringify({ limit_price: 80_000 }),
    })
    expect(events.find((event) => event.action === 'RESUME')).toMatchObject({
      user_id: 'dealer',
      old_value: 'PAUSED_SYSTEM',
      new_value: 'ACTIVE',
    })
    expect(actionsOf(engine, id).indexOf('MODIFY')).toBeLessThan(actionsOf(engine, id).indexOf('RESUME'))
  })

  it('sau khi sửa: sinh lệnh con với giá mới, không bị tạm dừng lại trong ngày', () => {
    const { engine, id } = iceberg()
    engine.repriceOrder(id, { version: 1, prices: { limit_price: 79_000 } }, 'dealer')
    engine.onMarketTick(day2(AFTER_OPEN + 1))
    engine.onMarketTick(day2(AFTER_OPEN + 2))

    expect(engine.getOrder(id).status).toBe('ACTIVE')
    expect(engine.getChildren(id).at(-1)).toMatchObject({ price: 79_000, quantity: 300 })
  })

  it('đã khớp một phần: chuyển lại PARTIALLY_EXECUTED, KL giữ nguyên', () => {
    const engine = newEngine()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 300)], { limit_price: 94_000, ...LONG_TERM })
    run(engine, 2)
    engine.applyExecution({ child_order_id: engine.getChildren(id)[0].child_order_id, exchange_match_id: 'M1', price: 94_000, qty: 100 })
    engine.onMarketTick(marketAt(CLOSE))
    engine.onMarketTick(day2(AFTER_OPEN))
    expect(engine.getOrder(id).status).toBe('PAUSED_SYSTEM')

    const order = engine.repriceOrder(id, { version: 1, prices: { limit_price: 80_000 } }, 'dealer')
    expect(order).toMatchObject({ status: 'PARTIALLY_EXECUTED', executed_qty: 100, total_qty: 1_000 })
  })

  it('giá mới vẫn ngoài biên độ hoặc sai bước: từ chối, lệnh giữ nguyên', () => {
    const { engine, id } = iceberg()
    const reprice = (limit_price: number) => engine.repriceOrder(id, { version: 1, prices: { limit_price } }, 'dealer')

    expect(() => reprice(90_000)).toThrow('trần')
    expect(() => reprice(70_000)).toThrow('sàn')
    expect(() => reprice(80_050)).toThrow('bước')
    expect(engine.getOrder(id)).toMatchObject({ status: 'PAUSED_SYSTEM', limit_price: 94_000, version: 1, reason_code: 'PRICE_OUT_OF_BAND' })
    expect(actionsOf(engine, id)).not.toContain('MODIFY')
  })

  it('không sửa giá nào: giá cũ vẫn ngoài biên độ nên từ chối', () => {
    const { engine, id } = iceberg()
    expect(() => engine.repriceOrder(id, { version: 1, prices: {} }, 'dealer')).toThrow('trần')
  })

  it('sai version: từ chối', () => {
    const { engine, id } = iceberg()
    expect(() => engine.repriceOrder(id, { version: 99, prices: { limit_price: 80_000 } }, 'dealer')).toThrow('nơi khác')
  })

  it('Tiếp tục vẫn bị khóa; form Sửa thường (đổi KL) bị từ chối', () => {
    const { engine, id } = iceberg()
    expect(() => engine.resumeOrder(id, 'dealer')).toThrow('không cho phép')
    expect(() => engine.updateOrder(id, { version: 1, total_qty: 2_000, limit_price: 80_000 }, 'dealer')).toThrow('chỉ được sửa giá')
    expect(engine.getOrder(id).total_qty).toBe(1_000)
  })

  it('khóa trong ATO và ATC', () => {
    const engine = newEngine()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 300)], { limit_price: 94_000, ...LONG_TERM })
    engine.onMarketTick(marketAt(CLOSE))
    engine.onMarketTick(day2(hhmm(9, 10)))
    const reprice = () => engine.repriceOrder(id, { version: 1, prices: { limit_price: 80_000 } }, 'dealer')
    expect(reprice).toThrow('ATO')
    engine.onMarketTick(day2(hhmm(14, 35)))
    expect(reprice).toThrow('ATC')
  })

  it('PAUSED_SYSTEM vì lý do khác và lệnh đang chạy không dùng được luồng này', () => {
    const engine = newEngine()
    const seed = createSeedData(new Date(2026, 10, 6))
    engine.load(seed)
    engine.onMarketTick({ ...marketAt(AT_1000), quotes: [{ ...quoteAt(41_000), symbol: 'VHM' }] })
    const system = seed.orders.find((order) => order.status === 'PAUSED_SYSTEM')?.parent_order_id ?? ''
    expect(() => engine.repriceOrder(system, { version: 1, prices: { limit_price: 41_000 } }, 'dealer')).toThrow('không cho phép')

    const running = createOrderEngine({ random: seededRandom(1) })
    running.onMarketTick(marketAt(AT_1000))
    const id = place(running, 'ICEBERG', [intParam('slice_qty', 300)], { limit_price: 99_000 })
    expect(() => running.repriceOrder(id, { version: 1, prices: { limit_price: 98_000 } }, 'dealer')).toThrow('Chỉ sửa giá được')
  })

  it('Stop: sửa trigger_price cập nhật cả điều kiện, kích hoạt theo giá mới', () => {
    const { engine, id } = pausedOrder('STOP', [intParam('trigger_price', 100_500)])
    expect(engine.getRepriceFields(id)).toEqual([{ name: 'trigger_price', value: 100_500 }])

    engine.repriceOrder(id, { version: 1, prices: { trigger_price: 81_000 } }, 'dealer')
    expect(engine.getConditions(id)[0].trigger_price).toBe(81_000)
    engine.onMarketTick(day2(AFTER_OPEN + 1, 80_500))
    expect(engine.getChildren(id)).toHaveLength(0)
    engine.onMarketTick(day2(AFTER_OPEN + 2, 81_000))
    expect(engine.getChildren(id)[0].order_type).toBe('MTL')
  })

  it('Stop: giá trigger sai phía so với giá khớp thì từ chối theo luật của ticket', () => {
    const { engine, id } = pausedOrder('STOP', [intParam('trigger_price', 100_500)])
    expect(() => engine.repriceOrder(id, { version: 1, prices: { trigger_price: 79_000 } }, 'dealer')).toThrow('cao hơn giá khớp')
    expect(engine.getOrder(id).status).toBe('PAUSED_SYSTEM')
  })

  it('OCO: sửa TP và SL cập nhật đúng từng điều kiện; thiếu một giá thì từ chối', () => {
    const { engine, id } = pausedOrder('OCO', [intParam('tp_price', 100_500), intParam('sl_price', 99_500)], { side: 'SELL' })
    expect(engine.getRepriceFields(id).map((field) => field.name)).toEqual(['tp_price', 'sl_price'])

    expect(() => engine.repriceOrder(id, { version: 1, prices: { tp_price: 82_000 } }, 'dealer')).toThrow('trần')
    engine.repriceOrder(id, { version: 1, prices: { tp_price: 82_000, sl_price: 78_000 } }, 'dealer')

    const [tp, sl] = engine.getConditions(id)
    expect([tp.condition_type, tp.trigger_price]).toEqual(['TAKE_PROFIT', 82_000])
    expect([sl.condition_type, sl.trigger_price]).toEqual(['STOP', 78_000])
    engine.onMarketTick(day2(AFTER_OPEN + 1, 82_000))
    expect(engine.getChildren(id)[0]).toMatchObject({ order_type: 'LO', price: 82_000 })
  })

  it('OCO đã kích hoạt TP: sửa giá TP thì lệnh con mới đặt theo giá đó, chỉ xét biên độ', () => {
    const engine = newEngine()
    const id = place(engine, 'OCO', [intParam('tp_price', 100_500), intParam('sl_price', 99_500)], { ...LONG_TERM, side: 'SELL', total_qty: 100_000 })
    engine.onMarketTick(marketAt(AT_1000 + 1, 100_500))
    engine.onMarketTick(marketAt(CLOSE))
    engine.onMarketTick(day2(AFTER_OPEN))
    expect(engine.getRepriceFields(id)).toEqual([{ name: 'tp_price', value: 100_500 }])

    engine.repriceOrder(id, { version: 1, prices: { tp_price: 79_000 } }, 'dealer')
    engine.onMarketTick(day2(AFTER_OPEN + 1))
    expect(engine.getChildren(id).at(-1)).toMatchObject({ order_type: 'LO', price: 79_000 })
  })

  it('giá không còn dùng tới gửi lên thì bị bỏ qua', () => {
    const engine = newEngine()
    const id = place(engine, 'BRACKET', [intParam('tp_price', 100_500), intParam('sl_price', 99_500)], { limit_price: 100_000, ...LONG_TERM })
    run(engine, 40, 100_000)
    engine.onMarketTick(marketAt(CLOSE))
    engine.onMarketTick(day2(AFTER_OPEN))
    expect(engine.getRepriceFields(id).map((field) => field.name)).toEqual(['tp_price', 'sl_price'])

    // Giá TP mới thấp hơn giá vào cũ vẫn được: lệnh đã vào đủ nên chỉ xét biên độ.
    engine.repriceOrder(id, { version: 1, prices: { limit_price: 80_000, tp_price: 82_000, sl_price: 78_000 } }, 'dealer')
    expect(engine.getOrder(id)).toMatchObject({ limit_price: 100_000, status: 'PARTIALLY_EXECUTED' })
  })

  it('giữ reason_code khi lưu và nạp lại; Hủy vẫn dùng được', () => {
    const { engine, id } = iceberg()
    const restored = createOrderEngine({ random: seededRandom(2) })
    restored.importState(JSON.parse(JSON.stringify(engine.exportState())))
    restored.onMarketTick(day2(AFTER_OPEN + 1))

    expect(restored.getOrder(id).reason_code).toBe('PRICE_OUT_OF_BAND')
    expect(restored.cancelOrder(id, 'dealer').status).toBe('CANCELLED')
  })
})

describe('lưu và nạp lại trạng thái', () => {
  const roundTrip = (engine: OrderEngine) => {
    const restored = createOrderEngine({ random: seededRandom(5) })
    restored.importState(JSON.parse(JSON.stringify(engine.exportState())))
    restored.onMarketTick(marketAt(AT_1000 + 500, 100_000))
    return restored
  }

  it('giữ nguyên lệnh, lệnh con, khớp, nhật ký và số thứ tự', () => {
    const engine = newEngine()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 300)], { limit_price: 100_500 })
    run(engine, 10)
    const before = JSON.parse(JSON.stringify(engine.exportState()))

    const restored = createOrderEngine({ random: seededRandom(5) })
    restored.importState(JSON.parse(JSON.stringify(engine.exportState())))
    expect(restored.exportState()).toEqual(before)
    expect(restored.getOrder(id).executed_qty).toBe(engine.getOrder(id).executed_qty)

    const created = restored.createOrder(request('ICEBERG', [intParam('slice_qty', 100)]), 'tester')
    expect(created.parent_order_id).not.toBe(id)
  })

  it('mã khớp đã thấy vẫn bị bỏ qua sau khi nạp lại', () => {
    const engine = newEngine()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 500)], { limit_price: 90_000 })
    run(engine, 2)
    const report = { child_order_id: engine.getChildren(id)[0].child_order_id, exchange_match_id: 'DUP', price: 90_000, qty: 100 }
    engine.applyExecution(report)

    const restored = roundTrip(engine)
    expect(restored.applyExecution(report)).toBe(false)
    expect(restored.getOrder(id).executed_qty).toBe(100)
  })

  it('điều kiện đã kích hoạt không bị kích hoạt lại, Tiếp tục vẫn sinh đúng lệnh con', () => {
    const engine = newEngine()
    const id = place(engine, 'OCO', [intParam('tp_price', 100_500), intParam('sl_price', 99_500)], { side: 'SELL' })
    engine.onMarketTick(marketAt(AT_1000 + 1, 99_500))
    engine.pauseOrder(id, 'tester')

    const restored = roundTrip(engine)
    restored.resumeOrder(id, 'tester')
    restored.onMarketTick(marketAt(AT_1000 + 600, 100_500))
    const live = restored.getChildren(id).filter((child) => isChildLive(child.status))
    expect(live.map((child) => child.order_type)).toEqual(['MTL'])
    expect(restored.getEvents(id).filter((event) => event.action === 'TRIGGER')).toHaveLength(1)
  })

  it('đã xử lý đóng cửa thì nạp lại cũng không mang sang lần hai', () => {
    const engine = newEngine()
    const id = place(engine, 'ICEBERG', [intParam('slice_qty', 500)], {
      limit_price: 90_000,
      persistence_mode: 'MULTI_SESSION',
      valid_to: '2026-12-31',
    })
    engine.onMarketTick(marketAt(hhmm(14, 45)))

    const restored = createOrderEngine({ random: seededRandom(5) })
    restored.importState(JSON.parse(JSON.stringify(engine.exportState())))
    restored.onMarketTick(marketAt(hhmm(14, 45)))
    const carries = restored.getEvents(id).filter((event) => event.new_value?.startsWith('CARRY_OVER'))
    expect(carries).toHaveLength(1)
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
    const engine = createOrderEngine({ random })
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

  describe('event FILL', () => {
    const fillEvents = (engine: OrderEngine, id: string) =>
      engine.getEvents(id).filter((event) => event.action === 'FILL')

    function placeWithChild() {
      const engine = newEngine()
      const id = place(engine, 'ICEBERG', [intParam('slice_qty', 1_000)], { limit_price: 90_000 })
      run(engine, 2) // Nhịp đầu sinh lệnh con, nhịp sau mới gửi đi. Giá đặt thấp nên chưa khớp.
      return { engine, id, childId: engine.getChildren(id)[0].child_order_id }
    }

    it('ghi KL, giá, mã khớp, và vẫn giữ trạng thái lệnh con trước, sau', () => {
      const { engine, id, childId } = placeWithChild()
      engine.applyExecution({ child_order_id: childId, exchange_match_id: 'M-1', price: 89_900, qty: 300 })

      expect(fillEvents(engine, id)).toHaveLength(1)
      expect(fillEvents(engine, id)[0]).toMatchObject({
        child_order_id: childId,
        old_value: 'ACKNOWLEDGED',
        new_value: 'PARTIAL_FILLED',
        fill_detail: { qty: 300, price: 89_900, exchange_match_id: 'M-1' },
      })
    })

    it('báo khớp vượt KL bị cắt bớt thì ghi KL thực nhận, không ghi KL trong báo khớp', () => {
      const { engine, id, childId } = placeWithChild()
      engine.applyExecution({ child_order_id: childId, exchange_match_id: 'M-1', price: 89_900, qty: 5_000 })

      expect(fillEvents(engine, id)[0].fill_detail?.qty).toBe(1_000)
    })

    it('báo khớp trùng không ghi thêm event', () => {
      const { engine, id, childId } = placeWithChild()
      const report = { child_order_id: childId, exchange_match_id: 'M-1', price: 89_900, qty: 300 }
      engine.applyExecution(report)
      engine.applyExecution(report)

      expect(fillEvents(engine, id)).toHaveLength(1)
    })

    it('khi engine tự chạy, mỗi Execution có đúng một event FILL cùng số liệu', () => {
      const engine = newEngine()
      const id = place(engine, 'ICEBERG', [intParam('slice_qty', 500)], { limit_price: 100_000 })
      run(engine, 30)

      const details = fillEvents(engine, id).map((event) => event.fill_detail)
      const executions = engine.getExecutions(id).map(({ qty, price, exchange_match_id }) => ({ qty, price, exchange_match_id }))
      expect(executions.length).toBeGreaterThan(0)
      expect(details).toEqual(executions)
    })

    it('lệnh mẫu: mỗi Execution có đúng một event FILL cùng số liệu', () => {
      const seed = createSeedData(new Date(2026, 10, 6))
      const details = seed.events.filter((event) => event.action === 'FILL').map((event) => event.fill_detail)
      const executions = seed.executions.map(({ qty, price, exchange_match_id }) => ({ qty, price, exchange_match_id }))
      expect(details).toEqual(executions)
    })

    it('giữ nguyên chi tiết sau khi lưu và nạp lại trạng thái', () => {
      const { engine, id, childId } = placeWithChild()
      engine.applyExecution({ child_order_id: childId, exchange_match_id: 'M-1', price: 89_900, qty: 300 })
      const restored = createOrderEngine()
      restored.importState(JSON.parse(JSON.stringify(engine.exportState())))

      expect(fillEvents(restored, id)[0].fill_detail).toEqual({ qty: 300, price: 89_900, exchange_match_id: 'M-1' })
    })
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

  it('lệnh mẫu PAUSED_SYSTEM có Notification lý do, engine nạp được', () => {
    const paused = seed.orders.find((order) => order.status === 'PAUSED_SYSTEM')
    const engine = createOrderEngine({ random: seededRandom(1) })
    engine.load(seed)

    const notifications = engine.getNotifications(paused?.parent_order_id ?? '')
    expect(notifications).toHaveLength(1)
    expect(notifications[0].notification_type).toBe('PARENT_PAUSED')
    expect(notifications[0].message).toContain('Core')
  })

  it('có Child UNKNOWN để demo, và lệnh ACTIVE chưa có khớp', () => {
    expect(seed.children.some((child) => child.status === 'UNKNOWN')).toBe(true)
    for (const order of seed.orders.filter((item) => item.status === 'ACTIVE')) {
      expect(order.executed_qty).toBe(0)
    }
  })

  it('engine nạp lệnh mẫu rồi chạy được, mã lệnh mới không trùng', () => {
    const engine = createOrderEngine({ random: seededRandom(1) })
    engine.load(seed)
    engine.onMarketTick({
      sim_seconds: AT_1000,
      quote_age_seconds: 0,
      trading_date: TODAY, session: 'CONTINUOUS',
      speed: 1,
      quotes: [{ ...quoteAt(27_500), symbol: 'HPG', ref_price: 27_500, ceiling_price: 29_400, floor_price: 25_600 }],
    })
    const iceberg = seed.orders.find((order) => order.symbol === 'HPG')
    expect(engine.getChildren(iceberg?.parent_order_id ?? '')).toHaveLength(1)

    const created = engine.createOrder(request('ICEBERG', [intParam('slice_qty', 100)], { limit_price: 27_500, symbol: 'HPG' }), 'tester')
    expect(seed.orders.map((order) => order.parent_order_id)).not.toContain(created.parent_order_id)
  })

  it('nạp lại thì lệnh đã đặt biến mất và dữ liệu mẫu gốc không bị đổi', () => {
    const engine = createOrderEngine({ random: seededRandom(1) })
    engine.load(seed)
    const before = seed.orders[0].status
    engine.onMarketTick({ sim_seconds: AT_1000, quote_age_seconds: 0, trading_date: TODAY, session: 'CONTINUOUS', speed: 1, quotes: [] })
    engine.cancelOrder(seed.orders[0].parent_order_id, 'tester')
    engine.createOrder(request('ICEBERG', [intParam('slice_qty', 100)]), 'tester')

    expect(seed.orders[0].status).toBe(before)
    engine.load(seed)
    expect(engine.listOrders()).toHaveLength(seed.orders.length)
    expect(engine.listOrders()[0].status).toBe(before)
  })
})
