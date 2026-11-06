import { describe, expect, it } from 'vitest'
import { createOrderEngine } from '@/mocks/engine'
import type {
  ChildOrder,
  CreateOrderRequest,
  Execution,
  MarketSnapshot,
  MarketState,
  ParentOrder,
  Side,
  StrategyParameter,
} from '@/types'
import { getOrderActionItems } from '@/utils/orderActions'
import { getSessionAt } from '@/utils/hose'
import { formatEventActor, formatEventValue } from './eventFormat'
import { getEntryExecutions, getFillSummary, getStrategyParamRows } from './orderMetrics'
import { buildOrderProgress, formatTimeTick, getTimeTicks } from './orderProgress'

const TODAY = '2026-11-06'
const YESTERDAY = '2026-11-05'
const at = (hour: number, minute: number) => hour * 3600 + minute * 60
const iso = (date: string, clock: string) => `${date}T${clock}`

function makeOrder(overrides: Partial<ParentOrder> = {}): ParentOrder {
  return {
    parent_order_id: 'PO-1',
    client_request_id: 'c1',
    account_no: 'A',
    symbol: 'FPT',
    side: 'BUY',
    total_qty: 1_000,
    executed_qty: 0,
    limit_price: 100_000,
    strategy_type: 'ICEBERG',
    status: 'ACTIVE',
    reason_code: null,
    valid_from: iso(TODAY, '09:00:00'),
    valid_to: TODAY,
    persistence_mode: 'DAY',
    version: 1,
    created_at: iso(TODAY, '09:00:00'),
    updated_at: iso(TODAY, '09:00:00'),
    ...overrides,
  }
}

function makeChild(id: string, side: Side): ChildOrder {
  return {
    child_order_id: id,
    parent_order_id: 'PO-1',
    cycle_no: 1,
    side,
    order_type: 'LO',
    price: 100_000,
    quantity: 500,
    filled_qty: 0,
    status: 'ACKNOWLEDGED',
    client_order_id: `CL-${id}`,
    idempotency_key: `IDEM-${id}`,
    core_order_id: null,
    created_at: iso(TODAY, '09:20:00'),
    sent_at: null,
  }
}

function makeFill(childId: string, price: number, qty: number, time = iso(TODAY, '09:30:00')): Execution {
  return {
    execution_id: `X-${childId}-${time}`,
    child_order_id: childId,
    parent_order_id: 'PO-1',
    exchange_match_id: `M-${childId}-${time}`,
    price,
    qty,
    match_time: time,
  }
}

const snapshot = (arrival: number): MarketSnapshot => ({
  arrival_price: arrival,
  arrival_bid: arrival,
  arrival_ask: arrival,
  arrival_timestamp: iso(TODAY, '09:00:00'),
})

describe('giá bình quân và chênh lệch so với arrival', () => {
  it('bình quân theo KL, chênh lệch theo bps', () => {
    const fills = [makeFill('C1', 100_000, 300), makeFill('C1', 101_000, 100)]
    const result = getFillSummary(makeOrder(), [makeChild('C1', 'BUY')], fills, snapshot(100_000))
    expect(result.avgPrice).toBe(100_250)
    expect(result.differenceBps).toBeCloseTo(25)
    expect(result.isFavorable).toBe(false)
  })

  it('cùng một chênh lệch thì lệnh bán có lợi, lệnh mua bất lợi', () => {
    const sell = makeOrder({ side: 'SELL' })
    const result = getFillSummary(sell, [makeChild('C1', 'SELL')], [makeFill('C1', 101_000, 100)], snapshot(100_000))
    expect(result.differenceBps).toBeCloseTo(100)
    expect(result.isFavorable).toBe(true)
  })

  it('bằng arrival thì 0 bps và không nói có lợi hay bất lợi', () => {
    const result = getFillSummary(makeOrder(), [makeChild('C1', 'BUY')], [makeFill('C1', 100_000, 100)], snapshot(100_000))
    expect(result.differenceBps).toBe(0)
    expect(result.isFavorable).toBeNull()
  })

  it('chưa khớp hoặc thiếu arrival thì không tính chênh lệch', () => {
    expect(getFillSummary(makeOrder(), [], [], snapshot(100_000))).toMatchObject({
      avgPrice: null,
      arrivalPrice: 100_000,
      differenceBps: null,
    })
    const noArrival = getFillSummary(makeOrder(), [makeChild('C1', 'BUY')], [makeFill('C1', 100_000, 100)], null)
    expect(noArrival).toMatchObject({ avgPrice: 100_000, arrivalPrice: null, differenceBps: null })
  })

  it('Bracket: lệnh thoát ngược chiều không tính vào giá bình quân', () => {
    const children = [makeChild('ENTRY', 'BUY'), makeChild('EXIT', 'SELL')]
    const fills = [makeFill('ENTRY', 100_000, 500), makeFill('EXIT', 110_000, 500)]
    expect(getEntryExecutions(makeOrder(), children, fills)).toEqual([fills[0]])
    expect(getFillSummary(makeOrder(), children, fills, snapshot(100_000)).avgPrice).toBe(100_000)
  })
})

describe('tham số của lệnh', () => {
  it('định dạng theo loại tham số, lấy giá giới hạn từ lệnh cha', () => {
    const order = makeOrder({ strategy_type: 'TWAP', limit_price: 117_000 })
    const parameters: StrategyParameter[] = [
      { parameter_code: 'start_time', parameter_value: '09:15', data_type: 'TIME' },
      { parameter_code: 'end_time', parameter_value: '11:15', data_type: 'TIME' },
      { parameter_code: 'interval_min', parameter_value: '15', data_type: 'INTEGER' },
    ]
    expect(getStrategyParamRows(order, parameters)).toEqual([
      { label: 'Bắt đầu', value: '09:15' },
      { label: 'Kết thúc', value: '11:15' },
      { label: 'Chu kỳ', value: '15 phút' },
      { label: 'Giá giới hạn', value: '117.000 đ' },
    ])
  })

  it('thiếu giá trị thì hiện gạch ngang', () => {
    expect(getStrategyParamRows(makeOrder({ strategy_type: 'STOP' }), [])).toEqual([
      { label: 'Giá kích hoạt', value: '—' },
    ])
  })
})

const TWAP_PARAMS: StrategyParameter[] = [
  { parameter_code: 'start_time', parameter_value: '09:15', data_type: 'TIME' },
  { parameter_code: 'end_time', parameter_value: '10:15', data_type: 'TIME' },
  { parameter_code: 'interval_min', parameter_value: '15', data_type: 'INTEGER' },
]

const twapOrder = (overrides: Partial<ParentOrder> = {}) => makeOrder({ strategy_type: 'TWAP', ...overrides })

function progressAt(order: ParentOrder, seconds: number, executions: Execution[] = [], children: ChildOrder[] = []) {
  return buildOrderProgress({
    order,
    parameters: TWAP_PARAMS,
    children,
    executions,
    tradingDate: TODAY,
    simSeconds: seconds,
  })
}

const rowAt = (progress: ReturnType<typeof progressAt>, clock: string, date = TODAY) =>
  progress.rows.find((row) => row.time === Date.parse(iso(date, clock)))

describe('dữ liệu biểu đồ', () => {
  it('TWAP: kế hoạch tăng theo từng chu kỳ và đạt đủ KL ở chu kỳ cuối', () => {
    const progress = progressAt(twapOrder(), at(9, 40))
    expect(progress.hasPlan).toBe(true)
    expect(rowAt(progress, '09:15:00')?.plan).toBe(300)
    expect(rowAt(progress, '09:30:00')?.plan).toBe(500)
    expect(rowAt(progress, '09:45:00')?.plan).toBe(800)
    expect(rowAt(progress, '10:00:00')?.plan).toBe(1_000)
    expect(rowAt(progress, '10:15:00')?.plan).toBe(1_000)
    expect(progress.plannedQty).toBe(500)
  })

  it('đường thực tế dừng ở thời điểm hiện tại, tương lai để trống', () => {
    const progress = progressAt(twapOrder(), at(9, 40), [makeFill('C1', 100_000, 300, iso(TODAY, '09:20:00'))])
    expect(rowAt(progress, '09:15:00')?.actual).toBe(0)
    expect(rowAt(progress, '09:20:00')?.actual).toBe(300)
    expect(rowAt(progress, '09:40:00')?.actual).toBe(300)
    expect(rowAt(progress, '09:45:00')?.actual).toBeNull()
  })

  it('chưa tới khung giờ thì có kế hoạch nhưng chưa có thực tế', () => {
    const progress = progressAt(twapOrder(), at(9, 0))
    expect(progress.plannedQty).toBeNull()
    expect(progress.rows.every((row) => row.actual === null)).toBe(true)
  })

  it('lệnh nhiều phiên: kế hoạch hôm nay chỉ chia phần còn lại, thực tế xuất phát từ phần đã khớp', () => {
    const order = twapOrder({ executed_qty: 400, persistence_mode: 'MULTI_SESSION', created_at: iso(YESTERDAY, '09:00:00') })
    const progress = progressAt(order, at(9, 20), [makeFill('C1', 100_000, 400, iso(YESTERDAY, '10:00:00'))])
    expect(progress.startingQty).toBe(400)
    expect(rowAt(progress, '09:15:00')).toMatchObject({ actual: 400, plan: 600 })
    expect(rowAt(progress, '10:15:00')?.plan).toBe(1_000)
    expect(progress.rows.every((row) => row.time >= Date.parse(iso(TODAY, '09:15:00')))).toBe(true)
  })

  it('lệnh đã kết thúc: vẽ theo ngày kết thúc, không theo đồng hồ hiện tại', () => {
    const order = twapOrder({ status: 'EXPIRED', updated_at: iso(YESTERDAY, '10:15:00') })
    const progress = progressAt(order, at(14, 0), [makeFill('C1', 100_000, 200, iso(YESTERDAY, '09:20:00'))])
    expect(rowAt(progress, '10:15:00', YESTERDAY)).toMatchObject({ actual: 200, plan: 1_000 })
    expect(progress.rows.at(-1)?.time).toBe(Date.parse(iso(YESTERDAY, '10:15:00')))
  })

  it('VWAP: kế hoạch chia theo chu kỳ 5 phút, không giảm và kết thúc bằng tổng KL', () => {
    const order = makeOrder({ strategy_type: 'VWAP', total_qty: 10_000 })
    const parameters = TWAP_PARAMS.slice(0, 2)
    const { rows } = buildOrderProgress({ order, parameters, children: [], executions: [], tradingDate: TODAY, simSeconds: at(9, 0) })
    const plans = rows.flatMap((row) => (row.plan === null ? [] : [row.plan]))
    expect(plans).toHaveLength(13)
    expect(plans.toSorted((a, b) => a - b)).toEqual(plans)
    expect(plans.at(-1)).toBe(10_000)
  })

  it('loại lệnh khác: chỉ có đường thực tế, xuất phát từ 0 lúc đặt lệnh', () => {
    const order = makeOrder()
    const progress = buildOrderProgress({
      order,
      parameters: [],
      children: [makeChild('C1', 'BUY')],
      executions: [makeFill('C1', 100_000, 200)],
      tradingDate: TODAY,
      simSeconds: at(9, 40),
    })
    expect(progress.hasPlan).toBe(false)
    expect(progress.plannedQty).toBeNull()
    expect(rowAt(progress, '09:00:00')).toEqual({ time: Date.parse(iso(TODAY, '09:00:00')), actual: 0, plan: null })
    expect(rowAt(progress, '09:40:00')?.actual).toBe(200)
  })

  it('Bracket: đường thực tế không cộng phần khớp của lệnh thoát', () => {
    const children = [makeChild('ENTRY', 'BUY'), makeChild('EXIT', 'SELL')]
    const executions = [makeFill('ENTRY', 100_000, 500), makeFill('EXIT', 110_000, 500, iso(TODAY, '09:35:00'))]
    const progress = buildOrderProgress({
      order: makeOrder({ strategy_type: 'BRACKET' }),
      parameters: [],
      children,
      executions,
      tradingDate: TODAY,
      simSeconds: at(9, 40),
    })
    expect(progress.rows.at(-1)?.actual).toBe(500)
  })

  it('đường kế hoạch khớp đúng KL mà engine thực sự sinh lệnh con', () => {
    const engine = createOrderEngine({ random: () => 0 })
    const market = (seconds: number): MarketState => ({
      trading_date: TODAY,
      sim_seconds: seconds,
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
          total_volume: 0,
          bid_price: 99_900,
          ask_price: 100_100,
          tick_direction: 0,
        },
      ],
    })
    engine.onMarketTick(market(at(9, 10)))
    // Giá đặt thấp hơn thị trường nên lệnh con không khớp: KL đang chờ chính là KL engine đã sinh.
    const request: CreateOrderRequest = {
      client_request_id: 'twap',
      account_no: 'A',
      symbol: 'FPT',
      side: 'BUY',
      total_qty: 1_000,
      limit_price: 99_000,
      strategy_type: 'TWAP',
      persistence_mode: 'DAY',
      valid_to: null,
      parameters: TWAP_PARAMS,
    }
    const id = engine.createOrder(request, 'tester').parent_order_id

    for (let seconds = at(9, 15); seconds < at(10, 15); seconds += 300) {
      engine.onMarketTick(market(seconds))
      const progress = buildOrderProgress({
        order: engine.getOrder(id),
        parameters: engine.getParameters(id),
        children: engine.getChildren(id),
        executions: engine.getExecutions(id),
        tradingDate: TODAY,
        simSeconds: seconds,
      })
      expect(progress.plannedQty).toBe(engine.getWorkingQty(id))
    }
  })
})

describe('trục thời gian', () => {
  const ms = (clock: string) => Date.parse(iso(TODAY, clock))

  it('mốc rơi vào giờ tròn, không quá nhiều mốc', () => {
    const ticks = getTimeTicks(ms('09:15:00'), ms('11:15:00'))
    expect(ticks.length).toBeLessThanOrEqual(7)
    expect(ticks[0]).toBe(ms('09:30:00'))
    expect(ticks[1] - ticks[0]).toBe(30 * 60_000)
  })

  it('khoảng quá ngắn hoặc chỉ một điểm vẫn có mốc hợp lệ', () => {
    expect(getTimeTicks(ms('09:15:10'), ms('09:15:20'))).toEqual([ms('09:15:10'), ms('09:15:20')])
    expect(getTimeTicks(ms('09:15:00'), ms('09:15:00'))).toEqual([ms('09:15:00')])
  })

  it('nhãn có ngày khi kéo dài qua nhiều ngày, có giây khi khoảng rất ngắn', () => {
    expect(formatTimeTick(ms('09:15:30'), 3_600_000)).toBe('09:15')
    expect(formatTimeTick(ms('09:15:30'), 60_000)).toBe('09:15:30')
    expect(formatTimeTick(ms('09:15:30'), 86_400_000)).toBe('06/11 09:15')
  })
})

describe('nhật ký', () => {
  const parentEvent = { child_order_id: null }
  const childEvent = { child_order_id: 'C1' }

  it('đổi mã trạng thái thành tiếng Việt theo đúng loại lệnh', () => {
    expect(formatEventValue('PARTIALLY_EXECUTED', parentEvent)).toBe('Khớp một phần')
    expect(formatEventValue('UNKNOWN', childEvent)).toBe('Chưa rõ')
    expect(formatEventValue(null, parentEvent)).toBe('—')
  })

  it('đọc được các chuỗi của engine', () => {
    expect(formatEventValue('{"total_qty":1000,"limit_price":null}', parentEvent)).toBe('KL 1.000, Giá giới hạn —')
    expect(formatEventValue('limit_price=41500,tp_price=45000', parentEvent)).toBe('Giá giới hạn 41.500, Giá TP 45.000')
    expect(formatEventValue('PRICE_OUT_OF_BAND:floor=93000,ceiling=107000', parentEvent)).toBe(
      'Ngoài biên độ (sàn 93.000, trần 107.000)',
    )
    expect(formatEventValue('CONDITION:TAKE_PROFIT:ACTIVE', parentEvent)).toBe('Điều kiện Take Profit: Đang chờ')
    expect(formatEventValue('TRIGGERED', parentEvent)).toBe('Đã kích hoạt')
    expect(formatEventValue('SESSION:2026-11-06', parentEvent)).toBe('Phiên 06/11/2026')
    expect(formatEventValue('CARRY_OVER:7000', parentEvent)).toBe('Mang sang phiên sau 7.000 CP')
  })

  it('tên người thực hiện', () => {
    expect(formatEventActor('SYSTEM')).toBe('Hệ thống')
    expect(formatEventActor('dealer')).toBe('dealer')
  })
})

describe('danh sách nút hành động', () => {
  it('đang tạm dừng thì hiện Tiếp tục thay cho Tạm dừng', () => {
    const labels = getOrderActionItems('PAUSED_USER', 'CONTINUOUS').map((item) => item.label)
    expect(labels).toEqual(['Sửa', 'Hủy', 'Tiếp tục'])
  })

  it('lệnh giá ngoài biên độ dùng nhãn Sửa giá', () => {
    expect(getOrderActionItems('PAUSED_SYSTEM', 'CONTINUOUS', 'PRICE_OUT_OF_BAND')[0].label).toBe('Sửa giá')
  })
})
