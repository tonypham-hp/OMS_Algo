import { describe, expect, it } from 'vitest'
import { SYSTEM_PARAM_DEFAULTS } from '@/config/systemParams'
import { explainOrder } from '@/explain/explain'
import type { EventReasonCode, MarketState, SessionCode, StrategyParameter, StrategyType, SymbolQuote } from '@/types'
import { getSessionAt } from '@/utils/hose'
import { createOrderEngine, type OrderEngine } from './engine'

const TODAY = '2026-11-06'
const AT_1000 = 10 * 3600
const ACCOUNT = '058C123456'

function quoteAt(last = 100_000, totalVolume = 0): SymbolQuote {
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
    ask_price: last,
    tick_direction: 0,
  }
}

function marketAt(seconds: number, options: { last?: number; volume?: number; quoteAge?: number; session?: SessionCode } = {}): MarketState {
  return {
    trading_date: TODAY,
    sim_seconds: seconds,
    quote_age_seconds: options.quoteAge ?? 0,
    session: options.session ?? getSessionAt(seconds),
    speed: 1,
    quotes: [quoteAt(options.last, options.volume)],
  }
}

const param = (code: string, value: number): StrategyParameter => ({ parameter_code: code, parameter_value: String(value), data_type: 'INTEGER' })

function setup(strategy: StrategyType = 'ICEBERG', parameters: StrategyParameter[] = [param('slice_qty', 500)], limitPrice: number | null = 90_000) {
  const engine = createOrderEngine({ random: () => 0 })
  let seconds = AT_1000
  engine.onMarketTick(marketAt(seconds))
  const id = engine.createOrder(
    {
      client_request_id: 'req',
      account_no: ACCOUNT,
      symbol: 'FPT',
      side: 'BUY',
      total_qty: 1_000,
      limit_price: limitPrice,
      strategy_type: strategy,
      persistence_mode: 'DAY',
      valid_to: null,
      parameters,
    },
    'tester',
  ).parent_order_id
  const tick = (count = 1, options: Parameters<typeof marketAt>[1] = {}) => {
    for (let index = 0; index < count; index += 1) {
      seconds += 1
      engine.onMarketTick(marketAt(seconds, options))
    }
  }
  const jump = (to: number, options: Parameters<typeof marketAt>[1] = {}) => {
    seconds = to
    engine.onMarketTick(marketAt(seconds, options))
  }
  return { engine, id, tick, jump }
}

const reasonsOf = (engine: OrderEngine, id: string) => engine.getEvents(id).map((event) => event.reason_code).filter(Boolean)
const lastReason = (engine: OrderEngine, id: string, reason: EventReasonCode) => engine.getEvents(id).filter((event) => event.reason_code === reason).at(-1)

describe('engine ghi reason_code cho mỗi lần đổi trạng thái', () => {
  it('tạm dừng, tiếp tục, hủy của người dùng', () => {
    const { engine, id, tick } = setup()
    tick(2)
    engine.pauseOrder(id, 'kh01')
    expect(lastReason(engine, id, 'USER_PAUSE')).toMatchObject({ action: 'PAUSE', new_value: 'PAUSED_USER', user_id: 'kh01' })
    engine.resumeOrder(id, 'kh01')
    expect(lastReason(engine, id, 'USER_RESUME')?.action).toBe('RESUME')
    engine.cancelOrder(id, 'kh01')
    expect(lastReason(engine, id, 'USER_CANCEL')?.new_value).toMatch(/CANCEL/)
  })

  it('Core từ chối kèm reject_code, lặp lại thì dừng với CHILD_REJECTED_REPEAT', () => {
    const { engine, id, tick } = setup()
    engine.injectRejectNext(id, 'LOT_SIZE')
    engine.injectRejectNext(id, 'LOT_SIZE')
    tick(3)
    const rejects = engine.getEvents(id).filter((event) => event.action === 'REJECT')
    expect(rejects).toHaveLength(SYSTEM_PARAM_DEFAULTS.MAX_CONSECUTIVE_REJECTS)
    expect(rejects.every((event) => event.reason_code === 'CORE_REJECT' && event.reject_code === 'LOT_SIZE')).toBe(true)
    expect(lastReason(engine, id, 'CHILD_REJECTED_REPEAT')).toMatchObject({ action: 'PAUSE', new_value: 'PAUSED_SYSTEM' })
  })

  it('từ chối không nêu lý do thì reject_code là OTHER', () => {
    const { engine, id, tick } = setup()
    engine.injectRejectNext(id)
    tick(2)
    expect(engine.getEvents(id).find((event) => event.action === 'REJECT')?.reject_code).toBe('OTHER')
  })

  it('mất ACK: ACK_TIMEOUT, đối soát xong: RECONCILED_CANCELLED hoặc RECONCILED_KEPT', () => {
    const lost = setup()
    lost.engine.injectTimeout(lost.id, 'TIMEOUT_BEFORE_CORE')
    lost.tick(2 + SYSTEM_PARAM_DEFAULTS.ACK_TIMEOUT_SECONDS + 6)
    expect(reasonsOf(lost.engine, lost.id)).toEqual(expect.arrayContaining(['ACK_TIMEOUT', 'RECONCILED_CANCELLED']))

    const kept = setup()
    kept.engine.injectTimeout(kept.id, 'TIMEOUT_AFTER_CORE')
    kept.tick(2 + SYSTEM_PARAM_DEFAULTS.ACK_TIMEOUT_SECONDS + 6)
    expect(reasonsOf(kept.engine, kept.id)).toEqual(expect.arrayContaining(['ACK_TIMEOUT', 'RECONCILED_KEPT']))
  })

  it('giá trễ: MARKET_DATA_STALE, có giá lại: MARKET_DATA_RESUMED', () => {
    const { engine, id, tick } = setup()
    tick(1)
    tick(1, { quoteAge: SYSTEM_PARAM_DEFAULTS.MAX_DATA_DELAY_SECONDS })
    expect(lastReason(engine, id, 'MARKET_DATA_STALE')?.new_value).toBe('PAUSED_SYSTEM')
    tick(1)
    expect(lastReason(engine, id, 'MARKET_DATA_RESUMED')?.action).toBe('RESUME')
  })

  it('kill switch: KILL_SWITCH ở cả event quyết định và event tạm dừng', () => {
    const { engine, id, tick } = setup()
    tick(1)
    engine.activateKillSwitch({ scope: 'ACCOUNT', account_no: ACCOUNT }, 'ops01')
    const events = engine.getEvents(id).filter((event) => event.reason_code === 'KILL_SWITCH')
    expect(events.map((event) => event.action)).toEqual(['DECISION', 'PAUSE'])
  })

  it('hết ngày với lệnh DAY: DAY_END', () => {
    const { engine, id, jump } = setup()
    jump(15 * 3600)
    expect(engine.getOrder(id).status).toBe('EXPIRED')
    expect(lastReason(engine, id, 'DAY_END')?.new_value).toBe('EXPIRED')
  })

  it('HUNT hết thời gian chờ: HUNT_MAX_WAIT', () => {
    const { engine, id, jump } = setup('HUNT', [param('hunt_price', 99_000), param('max_wait_min', 5)], 99_200)
    jump(AT_1000 + 300)
    expect(lastReason(engine, id, 'HUNT_MAX_WAIT')?.new_value).toBe('EXPIRED')
  })

  it('POV chạm % tối đa: ghi POV_THROTTLED một lần lúc bắt đầu bị chặn', () => {
    const { engine, id, tick } = setup('POV', [param('participation_pct', 10), param('max_pct', 1)], 90_000)
    let volume = 0
    for (let index = 0; index < 5; index += 1) {
      volume += 5_000
      tick(1, { volume })
    }
    const throttled = engine.getEvents(id).filter((event) => event.reason_code === 'POV_THROTTLED')
    expect(throttled).toHaveLength(1)
    expect(throttled[0].new_value).toContain('max_pct=1')
  })

  it('tích hợp: câu giải thích của lệnh bị Core từ chối lặp lại nêu lý do sai lô', () => {
    const { engine, id, tick } = setup()
    engine.injectRejectNext(id, 'LOT_SIZE')
    engine.injectRejectNext(id, 'LOT_SIZE')
    tick(3)
    const result = explainOrder(
      engine.getOrder(id),
      engine.getChildren(id),
      engine.getEvents(id),
      { session: 'CONTINUOUS', quote: quoteAt(), quote_age_seconds: 0, max_delay_seconds: null, max_rejects: SYSTEM_PARAM_DEFAULTS.MAX_CONSECUTIVE_REJECTS },
      'OPS',
    )
    expect(result.code).toBe('CHILD_REJECTED')
    expect(result.text).toContain('không phải bội số của lô 100')
    expect(result.actions.map((action) => action.label)).toContain('Mở lại')
  })
})
