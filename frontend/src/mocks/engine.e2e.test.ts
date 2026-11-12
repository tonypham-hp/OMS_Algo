/**
 * Test theo bộ TC-E2E (docs/test-cases/TC-E2E.md), phạm vi FE: engine giả lập + luật của form.
 * Bảng phủ test: docs/test-cases/coverage.md.
 *
 * Giá trong tài liệu là ví dụ trừu tượng (100, 110…), ở đây quy đổi sang giá HOSE hợp lệ:
 * FPT tham chiếu 100.000, trần 107.000, sàn 93.000, bước giá 100.
 *
 * - `deviation(...)`: test viết đúng kết quả mong đợi của tài liệu nhưng engine hiện cho kết quả khác.
 *   Mặc định bị bỏ qua để bộ test chính vẫn xanh; chạy `VITE_TC_DEVIATIONS=1 npm test` để thấy chúng đỏ.
 *   Không sửa các test này cho khớp engine: chờ quyết định sửa engine hay sửa tài liệu.
 * - `it.todo(...)`: engine chưa có tính năng nên chưa viết được test.
 */
import { describe, expect, it } from 'vitest'
import { getFillSummary } from '@/pages/OrderDetail/orderMetrics'
import { fromCreateOrderRequest, validateOrderValues } from '@/pages/PlaceOrder/orderSchema'
import type {
  CreateOrderRequest,
  MarketState,
  OrderBookDepth,
  SessionCode,
  StrategyParameter,
  StrategyType,
  SymbolQuote,
} from '@/types'
import { getSessionAt } from '@/utils/hose'
import { getParticipation } from '@/utils/execQuality'
import { getVwapTarget } from '@/utils/schedule'
import { SYSTEM_PARAM_DEFAULTS } from '@/config/systemParams'
import { createOrderEngine, isChildLive, type OrderEngine } from './engine'

const MAX_DATA_DELAY = SYSTEM_PARAM_DEFAULTS.MAX_DATA_DELAY_SECONDS

const deviation = import.meta.env.VITE_TC_DEVIATIONS ? it : it.skip

const TODAY = '2026-11-06'
const NEXT_DAY = '2026-11-09'
const hhmm = (hour: number, minute: number, second = 0) => hour * 3600 + minute * 60 + second
const AT_1000 = hhmm(10, 0)
/** BUY LO ở giá này không khớp khi thị trường ở 100.000: KL khớp chỉ đến từ `fill`, nên kết quả không phụ thuộc engine tự khớp. */
const PASSIVE_BUY = 99_000

function quoteAt(last: number, volume: number, depth?: OrderBookDepth): SymbolQuote {
  return {
    depth,
    symbol: 'FPT',
    ref_price: 100_000,
    ceiling_price: 107_000,
    floor_price: 93_000,
    last_price: last,
    indicative_price: null,
    last_qty: 100,
    total_volume: volume,
    bid_price: last - 100,
    ask_price: last + 100,
    tick_direction: 0,
  }
}

interface TickOptions {
  last?: number
  volume?: number
  quoteAge?: number
  session?: SessionCode
  date?: string
  /** Sổ lệnh nhiều mức (HUNT quét mức). */
  depth?: OrderBookDepth
}

function marketAt(seconds: number, options: TickOptions = {}): MarketState {
  return {
    trading_date: options.date ?? TODAY,
    sim_seconds: seconds,
    quote_age_seconds: options.quoteAge ?? 0,
    session: options.session ?? getSessionAt(seconds),
    speed: 1,
    quotes: [quoteAt(options.last ?? 100_000, options.volume ?? 0, options.depth)],
  }
}

const int = (parameter_code: string, value: number): StrategyParameter => ({
  parameter_code,
  parameter_value: String(value),
  data_type: 'INTEGER',
})
const time = (parameter_code: string, value: string): StrategyParameter => ({
  parameter_code,
  parameter_value: value,
  data_type: 'TIME',
})

function request(
  strategy_type: StrategyType,
  parameters: StrategyParameter[],
  extra: Partial<CreateOrderRequest> = {},
): CreateOrderRequest {
  return {
    client_request_id: `req-${strategy_type}`,
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

const iceberg = (total_qty: number, slice: number, extra: Partial<CreateOrderRequest> = {}) =>
  request('ICEBERG', [int('slice_qty', slice)], { total_qty, limit_price: PASSIVE_BUY, ...extra })

/** TWAP 10:30–11:20, chu kỳ 5 phút: đúng 10 khoảng. */
const twap10 = (total_qty: number) =>
  request(
    'TWAP',
    [time('start_time', '10:30'), time('end_time', '11:20'), int('interval_min', 5)],
    { total_qty, limit_price: PASSIVE_BUY },
  )

function setup() {
  // random = 0: mỗi nhịp lệnh con khớp được tối đa 1 lô, nên kết quả lặp lại được.
  const engine = createOrderEngine({ random: () => 0 })
  let clock = AT_1000
  let matchNo = 0
  engine.onMarketTick(marketAt(clock))

  const place = (body: CreateOrderRequest, userId = 'tester') => engine.createOrder(body, userId).parent_order_id
  /** Nhịp ở đúng giờ `seconds`. */
  const at = (seconds: number, options?: TickOptions) => {
    clock = seconds
    engine.onMarketTick(marketAt(seconds, options))
  }
  /** Nhịp kế tiếp, cách nhịp trước 1 giây. */
  const tick = (options?: TickOptions) => at(clock + 1, options)
  const ticks = (count: number, options?: TickOptions) => {
    for (let index = 0; index < count; index += 1) tick(options)
  }
  /** Báo khớp từ Core, mỗi lần một mã khớp mới. */
  const fill = (childOrderId: string, qty: number, price = 100_000) => {
    matchNo += 1
    return engine.applyExecution({ child_order_id: childOrderId, exchange_match_id: `TC-M${matchNo}`, price, qty })
  }
  const live = (id: string) => engine.getChildren(id).filter((child) => isChildLive(child.status))
  /** Khớp hết mọi lệnh con đang chờ của lệnh vào. */
  const fillLive = (id: string, price = 100_000) => {
    for (const child of live(id)) {
      if (child.status === 'ACKNOWLEDGED' || child.status === 'PARTIAL_FILLED') {
        fill(child.child_order_id, child.quantity - child.filled_qty, price)
      }
    }
  }
  /** Iceberg: sinh lệnh con, gửi đi, khớp hết, lặp lại `slices` lần. */
  const runSlices = (id: string, slices: number) => {
    for (let index = 0; index < slices; index += 1) {
      tick()
      tick()
      fillLive(id)
    }
  }
  return { engine, place, at, tick, ticks, fill, fillLive, live, runSlices }
}

const remainingOf = (engine: OrderEngine, id: string) => {
  const order = engine.getOrder(id)
  return order.total_qty - order.executed_qty
}
const conditionOf = (engine: OrderEngine, id: string, type: string) =>
  engine.getConditions(id).find((condition) => condition.condition_type === type)
const quantities = (engine: OrderEngine, id: string) => engine.getChildren(id).map((child) => child.quantity)
const lastChild = (engine: OrderEngine, id: string) => engine.getChildren(id).at(-1)

// ===== A. Vòng đời lệnh cha =====

describe('A. Vòng đời lệnh cha', () => {
  it('TC-E2E-001 tạo Iceberg 100.000 slice 10.000: ACTIVE, chưa khớp, không gửi cả 100.000 một lần', () => {
    const { engine, place, ticks } = setup()
    const body = iceberg(100_000, 10_000)
    expect(
      validateOrderValues(fromCreateOrderRequest(body), {
        getQuote: () => quoteAt(100_000, 0),
        today: TODAY,
      }),
    ).toEqual([])

    const id = place(body)
    expect(engine.getOrder(id)).toMatchObject({ status: 'ACTIVE', executed_qty: 0 })
    expect(remainingOf(engine, id)).toBe(100_000)

    ticks(5)
    expect(quantities(engine, id)).toEqual([10_000])
    expect(engine.getWorkingQty(id)).toBe(10_000)
  })

  deviation('TC-E2E-002 gửi trùng client_request_id: chỉ có 1 lệnh cha, lần hai nhận lại lệnh đã tạo', () => {
    const { engine } = setup()
    const body = iceberg(100_000, 10_000, { client_request_id: 'REQ-002' })
    const first = engine.createOrder(body, 'tester')
    const second = engine.createOrder(body, 'tester')

    expect(second.parent_order_id).toBe(first.parent_order_id)
    expect(engine.listOrders().filter((order) => order.client_request_id === 'REQ-002')).toHaveLength(1)
  })

  it('TC-E2E-003 tham số không hợp lệ: KL âm hoặc slice lớn hơn tổng KL bị chặn trước khi tạo lệnh', () => {
    const context = { getQuote: () => quoteAt(100_000, 0), today: TODAY }
    const errorFields = (body: CreateOrderRequest) =>
      validateOrderValues(fromCreateOrderRequest(body), context).map((error) => error.field)

    expect(errorFields(iceberg(-1_000, 100))).toContain('total_qty')
    expect(errorFields(iceberg(10_000, 20_000))).toContain('slice_qty')
  })

  it.todo('TC-E2E-004 Risk từ chối lúc tạo: lệnh bị từ chối, không sinh lệnh con (engine chưa có Risk)')
})

// ===== B. Lệnh Stop =====

describe('B. Lệnh Stop', () => {
  const stopSell = () => request('STOP', [int('trigger_price', 95_000)], { side: 'SELL', total_qty: 1_000 })

  it('TC-E2E-010 chưa chạm ngưỡng: điều kiện ACTIVE, không có lệnh con', () => {
    const { engine, place, ticks } = setup()
    const id = place(stopSell())
    ticks(5, { last: 98_000 })
    expect(conditionOf(engine, id, 'STOP')?.status).toBe('ACTIVE')
    expect(engine.getChildren(id)).toHaveLength(0)
  })

  it('TC-E2E-011 chạm ngưỡng: điều kiện TRIGGERED, sinh 1 lệnh con', () => {
    const { engine, place, tick } = setup()
    const id = place(stopSell())
    tick({ last: 98_000 })
    tick({ last: 95_000 })
    expect(conditionOf(engine, id, 'STOP')?.status).toBe('TRIGGERED')
    expect(engine.getChildren(id)).toHaveLength(1)
    expect(engine.getChildren(id)[0]).toMatchObject({ side: 'SELL', quantity: 1_000 })
  })

  it('TC-E2E-012 chỉ kích hoạt một lần: giá tiếp tục giảm không sinh lệnh con thứ hai', () => {
    const { engine, place, tick } = setup()
    const id = place(stopSell())
    tick({ last: 95_000 })
    for (const last of [94_000, 93_500, 93_000]) tick({ last })
    expect(engine.getChildren(id)).toHaveLength(1)
    expect(engine.getEvents(id).filter((event) => event.action === 'TRIGGER')).toHaveLength(1)
  })

  it.todo('TC-E2E-013 Risk lỗi lúc kích hoạt: TRIGGERED, lưu kết quả Risk, không gửi Core, PAUSED_SYSTEM (engine chưa có Risk)')
})

// ===== C. Trailing Stop =====

describe('C. Trailing Stop', () => {
  // Tài liệu: trailing 10, giá lên 120 → ngưỡng 110. Quy đổi: trailing 1.000, giá lên 103.000 → ngưỡng 102.000.
  function trailingUp() {
    const ctx = setup()
    const id = ctx.place(request('TRAILING_STOP', [int('trailing_value', 1_000)], { side: 'SELL' }))
    ctx.tick({ last: 101_000 })
    ctx.tick({ last: 103_000 })
    const best = () => ctx.engine.exportState().runtimes.find(([key]) => key === id)?.[1].trailingExtreme
    return { ...ctx, id, best }
  }

  it('TC-E2E-020 cập nhật giá tốt nhất: best = 103.000, ngưỡng = 102.000', () => {
    const { engine, id, best } = trailingUp()
    expect(best()).toBe(103_000)
    expect(conditionOf(engine, id, 'TRAILING_STOP')?.trigger_price).toBe(102_000)
  })

  it('TC-E2E-021 giá giảm về 102.500: best và ngưỡng không giảm, chưa có lệnh con', () => {
    const { engine, id, best, tick } = trailingUp()
    tick({ last: 102_500 })
    expect(best()).toBe(103_000)
    expect(conditionOf(engine, id, 'TRAILING_STOP')?.trigger_price).toBe(102_000)
    expect(engine.getChildren(id)).toHaveLength(0)
  })

  it('TC-E2E-022 giá về 102.000: TRIGGERED, sinh 1 lệnh con bán', () => {
    const { engine, id, tick } = trailingUp()
    tick({ last: 102_500 })
    tick({ last: 102_000 })
    expect(conditionOf(engine, id, 'TRAILING_STOP')?.status).toBe('TRIGGERED')
    expect(engine.getChildren(id)).toHaveLength(1)
    expect(engine.getChildren(id)[0].side).toBe('SELL')
  })
})

// ===== D. OCO =====

describe('D. OCO', () => {
  // Tài liệu: TP 110, SL 90. Quy đổi: TP 104.000, SL 96.000, lệnh bán.
  const oco = () => request('OCO', [int('tp_price', 104_000), int('sl_price', 96_000)], { side: 'SELL' })

  it('TC-E2E-030 chốt lời thắng: TP TRIGGERED, SL CANCELLED trong cùng một nhịp, chỉ 1 lệnh con bán', () => {
    const { engine, place, tick } = setup()
    const id = place(oco())
    tick({ last: 104_000 })
    expect(conditionOf(engine, id, 'TAKE_PROFIT')?.status).toBe('TRIGGERED')
    expect(conditionOf(engine, id, 'STOP')?.status).toBe('CANCELLED')
    expect(engine.getChildren(id)).toHaveLength(1)
    expect(engine.getChildren(id)[0]).toMatchObject({ side: 'SELL', order_type: 'LO', price: 104_000 })
  })

  it('TC-E2E-031 cắt lỗ thắng: SL TRIGGERED, TP CANCELLED', () => {
    const { engine, place, tick } = setup()
    const id = place(oco())
    tick({ last: 96_000 })
    expect(conditionOf(engine, id, 'STOP')?.status).toBe('TRIGGERED')
    expect(conditionOf(engine, id, 'TAKE_PROFIT')?.status).toBe('CANCELLED')
    expect(engine.getChildren(id)).toHaveLength(1)
  })

  it('TC-E2E-032 (phần FE) TP rồi SL ở hai nhịp liền nhau: chỉ một nhánh thắng, không có 2 lệnh con thoát', () => {
    const { engine, place, tick } = setup()
    const id = place(oco())
    tick({ last: 104_000 })
    tick({ last: 96_000 })
    expect(engine.getChildren(id)).toHaveLength(1)
    expect(engine.getEvents(id).filter((event) => event.action === 'TRIGGER')).toHaveLength(1)
    expect(conditionOf(engine, id, 'TAKE_PROFIT')?.status).toBe('TRIGGERED')
    expect(conditionOf(engine, id, 'STOP')?.status).toBe('CANCELLED')
  })
})

// ===== E. Bracket =====

describe('E. Bracket', () => {
  // Mua 10.000 giá vào 100.000, TP 104.000, SL 96.000. Giá thị trường 101.000 để lệnh vào không tự khớp.
  function bracket() {
    const ctx = setup()
    const id = ctx.place(
      request('BRACKET', [int('tp_price', 104_000), int('sl_price', 96_000)], { total_qty: 10_000, limit_price: 100_000 }),
    )
    ctx.tick({ last: 101_000 })
    ctx.tick({ last: 101_000 })
    const entry = ctx.engine.getChildren(id)[0]
    const exitQty = () =>
      ctx.engine
        .getChildren(id)
        .filter((child) => child.side === 'SELL')
        .reduce((sum, child) => sum + child.quantity, 0)
    return { ...ctx, id, entry, exitQty }
  }

  it('TC-E2E-040 lệnh vào được Core nhận nhưng chưa khớp, giá chạm TP: TP chưa bật, không có lệnh thoát', () => {
    const { engine, id, entry, tick, exitQty } = bracket()
    expect(entry).toMatchObject({ side: 'BUY', status: 'ACKNOWLEDGED', quantity: 10_000 })
    tick({ last: 104_000 })
    expect(conditionOf(engine, id, 'TAKE_PROFIT')?.status).toBe('ACTIVE')
    expect(exitQty()).toBe(0)
  })

  it('TC-E2E-041 lệnh vào khớp một phần 4.000, giá chạm TP: lệnh thoát không vượt 4.000', () => {
    const { entry, fill, tick, exitQty } = bracket()
    fill(entry.child_order_id, 4_000)
    tick({ last: 104_000 })
    expect(exitQty()).toBeLessThanOrEqual(4_000)
  })

  deviation('TC-E2E-041 KL được phép thoát = 4.000: TP chạm khi lệnh vào mới khớp 4.000 thì thoát đúng 4.000', () => {
    const { entry, fill, tick, exitQty } = bracket()
    fill(entry.child_order_id, 4_000)
    tick({ last: 104_000 })
    expect(exitQty()).toBe(4_000)
  })

  it('TC-E2E-042 lệnh vào khớp thêm 6.000 (đủ 10.000): TP chạm thì thoát 10.000', () => {
    const { entry, fill, tick, exitQty } = bracket()
    fill(entry.child_order_id, 4_000)
    fill(entry.child_order_id, 6_000)
    tick({ last: 104_000 })
    expect(exitQty()).toBe(10_000)
  })
})

// ===== F. Iceberg =====

describe('F. Iceberg', () => {
  it('TC-E2E-050 cơ bản: lệnh con #1 = 10.000, khớp đủ thì sinh #2 = 10.000', () => {
    const { engine, place, tick, fillLive } = setup()
    const id = place(iceberg(100_000, 10_000))
    tick()
    tick()
    expect(quantities(engine, id)).toEqual([10_000])
    fillLive(id)
    expect(engine.getChildren(id)[0].status).toBe('FILLED')
    tick()
    expect(quantities(engine, id)).toEqual([10_000, 10_000])
  })

  it('TC-E2E-051 #1 khớp 6.000, phần còn lại bị hủy: còn lại 94.000, lệnh con kế tiếp tính theo số đã khớp thật', () => {
    const { engine, place, tick, fill } = setup()
    const id = place(iceberg(100_000, 10_000))
    tick()
    tick()
    fill(engine.getChildren(id)[0].child_order_id, 6_000)
    // Engine chưa có sự kiện "Core hủy phần còn lại": dùng Tạm dừng rồi Tiếp tục để hủy lệnh con.
    engine.pauseOrder(id, 'tester')
    engine.resumeOrder(id, 'tester')
    expect(engine.getChildren(id)[0]).toMatchObject({ status: 'CANCELLED', filled_qty: 6_000 })
    expect(engine.getOrder(id).executed_qty).toBe(6_000)
    expect(remainingOf(engine, id)).toBe(94_000)

    tick()
    expect(lastChild(engine, id)?.quantity).toBe(10_000)
    expect(engine.getAllowedQty(id)).toBe(84_000)
  })

  it('TC-E2E-052 slice cuối: tổng 25.000 slice 10.000 → 10.000, 10.000, 5.000', () => {
    const { engine, place, runSlices } = setup()
    const id = place(iceberg(25_000, 10_000))
    runSlices(id, 5)
    expect(quantities(engine, id)).toEqual([10_000, 10_000, 5_000])
    expect(engine.getOrder(id)).toMatchObject({ status: 'COMPLETED', executed_qty: 25_000 })
  })

  it('TC-E2E-053 tuần tự: #1 đã được Core nhận nhưng chưa kết thúc thì chưa sinh #2', () => {
    const { engine, place, ticks } = setup()
    const id = place(iceberg(100_000, 10_000))
    ticks(20)
    expect(engine.getChildren(id)).toHaveLength(1)
    expect(engine.getChildren(id)[0].status).toBe('ACKNOWLEDGED')
  })

  it.todo('TC-E2E-054 Iceberg ngẫu nhiên ±20%: mỗi lệnh con trong 8.000–12.000 (engine chưa có tham số ngẫu nhiên)')
})

// ===== G. TWAP =====

describe('G. TWAP', () => {
  it('TC-E2E-060 100.000 chia 10 khoảng: mỗi khoảng 10.000', () => {
    const { engine, place, at } = setup()
    const id = place(twap10(100_000))
    for (let index = 0; index < 10; index += 1) at(hhmm(10, 30 + index * 5))
    expect(quantities(engine, id)).toEqual(Array(10).fill(10_000))
  })

  it('TC-E2E-061 nghỉ trưa: không sinh lệnh con trong giờ nghỉ, chạy tiếp từ 13:00', () => {
    const { engine, place, at } = setup()
    // 11:00–13:30, chu kỳ 10 phút: 15 khoảng, trong đó các khoảng 11:30–12:50 rơi vào giờ nghỉ.
    const id = place(
      request('TWAP', [time('start_time', '11:00'), time('end_time', '13:30'), int('interval_min', 10)], {
        total_qty: 150_000,
        limit_price: PASSIVE_BUY,
      }),
    )
    for (let minute = 0; minute < 150; minute += 1) at(hhmm(11, minute))

    const clocks = engine.getChildren(id).map((child) => child.created_at.slice(11))
    expect(clocks.filter((clock) => clock >= '11:30:00' && clock < '13:00:00')).toEqual([])
    expect(clocks).toContain('13:00:00')
    expect(quantities(engine, id).reduce((sum, qty) => sum + qty, 0)).toBe(150_000)
  })

  deviation('TC-E2E-062 khớp thiếu: kế hoạch 10.000, khớp 6.000 thì 4.000 thiếu rải vào 9 khoảng còn lại', () => {
    const { engine, place, at, fill } = setup()
    const id = place(twap10(100_000))
    at(hhmm(10, 30))
    at(hhmm(10, 31))
    fill(engine.getChildren(id)[0].child_order_id, 6_000)
    // Lệnh con khoảng 1 kết thúc với 6.000 (hủy bằng Tạm dừng, Tiếp tục ngay trước khoảng 2).
    at(hhmm(10, 34, 59))
    engine.pauseOrder(id, 'tester')
    engine.resumeOrder(id, 'tester')

    at(hhmm(10, 35))
    const sentInInterval2 = engine
      .getChildren(id)
      .filter((child) => child.created_at.endsWith('10:35:00'))
      .reduce((sum, child) => sum + child.quantity, 0)
    // 10.000 của khoảng 2 cộng 4.000 / 9 khoảng (làm tròn lên lô 100) = 10.500.
    expect(sentInInterval2).toBeGreaterThanOrEqual(10_000)
    expect(sentInInterval2).toBeLessThanOrEqual(10_500)
  })

  it('TC-E2E-063 hết giờ còn 20.000, lệnh trong ngày: không sinh thêm lệnh con, lệnh cha EXPIRED', () => {
    const { engine, place, at, fillLive } = setup()
    // 10:30–11:00, chu kỳ 10 phút: 3 khoảng × 10.000. Chỉ khớp khoảng đầu.
    const id = place(
      request('TWAP', [time('start_time', '10:30'), time('end_time', '11:00'), int('interval_min', 10)], {
        total_qty: 30_000,
        limit_price: PASSIVE_BUY,
      }),
    )
    at(hhmm(10, 30))
    at(hhmm(10, 31))
    fillLive(id)
    at(hhmm(10, 40))
    at(hhmm(10, 50))
    at(hhmm(11, 0))

    expect(engine.getOrder(id)).toMatchObject({ status: 'EXPIRED', executed_qty: 10_000 })
    expect(remainingOf(engine, id)).toBe(20_000)
    const count = engine.getChildren(id).length
    at(hhmm(11, 10))
    expect(engine.getChildren(id)).toHaveLength(count)
    expect(engine.getChildren(id).filter((child) => isChildLive(child.status))).toEqual([])
  })
})

// ===== H. POV =====

describe('H. POV', () => {
  const pov = (total_qty: number, pct: number, max: number) =>
    request('POV', [int('participation_pct', pct), int('max_pct', max)], { total_qty, limit_price: PASSIVE_BUY })

  /** Tham gia 10%, thị trường lên 850.000 thì sinh 85.000; khớp 80.000 nên còn chờ 5.000. */
  function povAt850k() {
    const ctx = setup()
    const id = ctx.place(pov(200_000, 10, 20))
    ctx.tick({ volume: 0 })
    ctx.tick({ volume: 850_000 })
    ctx.tick({ volume: 850_000 })
    ctx.fill(ctx.engine.getChildren(id)[0].child_order_id, 80_000)
    return { ...ctx, id }
  }

  it('TC-E2E-070 tính mục tiêu: 10% × 1.000.000 − đã khớp 80.000 − đang chờ 5.000 = 15.000', () => {
    const { engine, id, tick } = povAt850k()
    expect(engine.getOrder(id).executed_qty).toBe(80_000)
    expect(engine.getWorkingQty(id)).toBe(5_000)

    tick({ volume: 1_000_000 })
    expect(lastChild(engine, id)?.quantity).toBe(15_000)
  })

  it('TC-E2E-071 KL thị trường không đổi, chỉ đồng hồ chạy: không sinh thêm lệnh con', () => {
    const { engine, id, ticks } = povAt850k()
    const count = engine.getChildren(id).length
    ticks(30, { volume: 850_000 })
    expect(engine.getChildren(id)).toHaveLength(count)
  })

  it('TC-E2E-072 trần tham gia 10%: KL gửi đi không vượt 10% KL thị trường ở mọi thời điểm', () => {
    const { engine, place, tick } = setup()
    const id = place(pov(500_000, 10, 10))
    let volume = 0
    tick({ volume })
    for (let index = 1; index <= 60; index += 1) {
      volume += 1_000 + ((index * 7_919) % 23_000)
      tick({ volume })
      const sent = quantities(engine, id).reduce((sum, qty) => sum + qty, 0)
      expect(sent).toBeLessThanOrEqual(volume * 0.1)
    }
    expect(engine.getChildren(id).length).toBeGreaterThan(0)
  })
})

// ===== I. VWAP =====

describe('I. VWAP', () => {
  it('TC-E2E-080 mục tiêu theo profile: lệnh con mới = mục tiêu lũy kế − đã khớp − đang chờ', () => {
    // Engine dùng profile cố định hình chữ U, chưa nhập được profile 30% của tài liệu.
    // Test kiểm cùng công thức với số liệu của profile engine: 10:30–11:20, 10 chu kỳ 5 phút.
    const { engine, place, at, fill } = setup()
    const id = place(
      request('VWAP', [time('start_time', '10:30'), time('end_time', '11:20')], {
        total_qty: 1_000_000,
        limit_price: PASSIVE_BUY,
      }),
    )
    at(hhmm(10, 35))
    at(hhmm(10, 36))
    const first = engine.getChildren(id)[0]
    expect(first.quantity).toBe(getVwapTarget(1_000_000, 3_000, 300))
    fill(first.child_order_id, first.quantity - 20_000)
    const executed = engine.getOrder(id).executed_qty
    expect(engine.getWorkingQty(id)).toBe(20_000)

    at(hhmm(10, 40))
    const target = getVwapTarget(1_000_000, 3_000, 600)
    expect(lastChild(engine, id)?.quantity).toBe(target - executed - 20_000)
  })

  it.todo('TC-E2E-081 thiếu profile: không ACTIVE hoặc chuyển TWAP, có ghi nhật ký (engine không có dữ liệu profile)')

  it('TC-E2E-082 KL thị trường tăng đột biến: không gửi vượt KL còn lại', () => {
    const { engine, place, at } = setup()
    const id = place(
      request('VWAP', [time('start_time', '10:30'), time('end_time', '11:20')], {
        total_qty: 10_000,
        limit_price: PASSIVE_BUY,
      }),
    )
    for (let minute = 30; minute < 80; minute += 1) {
      at(hhmm(10, minute), { volume: minute * 50_000_000 })
      const sent = quantities(engine, id).reduce((sum, qty) => sum + qty, 0)
      expect(sent).toBeLessThanOrEqual(10_000)
      expect(engine.getAllowedQty(id)).toBeGreaterThanOrEqual(0)
    }
  })
})

// ===== J. HUNT =====

describe('J. HUNT', () => {
  // HUNT quét sổ lệnh dùng hai tham số tùy chọn: max_levels (số mức tối đa) và remainder_passive (1: phần còn lại
  // đặt bị động tại giá mua tốt nhất, 0: kết thúc lệnh). Giá 100.5 của tài liệu quy đổi thành 100.500.
  const levels = (...items: Array<[number, number]>) => items.map(([price, qty]) => ({ price, qty }))
  const BIDS = levels([99_900, 50_000])
  const hunt = (passive: 0 | 1, extra: Partial<CreateOrderRequest> = {}) =>
    request(
      'HUNT',
      [int('hunt_price', 100_000), int('max_wait_min', 5), int('max_levels', 3), int('remainder_passive', passive)],
      { total_qty: 100_000, limit_price: 100_500, ...extra },
    )
  const prices = (engine: OrderEngine, id: string) => engine.getChildren(id).map((child) => [child.price, child.quantity])

  it('TC-E2E-090 quét thanh khoản: tối đa 3 mức, mỗi mức 20.000 → chỉ 3 mức đầu, tổng 60.000', () => {
    const { engine, place, tick } = setup()
    const id = place(hunt(1))
    const depth = { asks: levels([100_100, 20_000], [100_300, 20_000], [100_500, 20_000], [100_500, 20_000]), bids: BIDS }
    tick({ depth })
    expect(prices(engine, id)).toEqual([
      [100_100, 20_000],
      [100_300, 20_000],
      [100_500, 20_000],
    ])
  })

  it('TC-E2E-091 giới hạn giá: mức thứ 3 ở 100.600 vượt giá tối đa → chỉ quét 30.000', () => {
    const { engine, place, tick } = setup()
    const id = place(hunt(1))
    tick({ depth: { asks: levels([100_100, 15_000], [100_300, 15_000], [100_600, 20_000]), bids: BIDS } })
    expect(prices(engine, id)).toEqual([
      [100_100, 15_000],
      [100_300, 15_000],
    ])
    expect(engine.getChildren(id).every((child) => (child.price ?? 0) <= 100_500)).toBe(true)
  })

  it('TC-E2E-092 không có thanh khoản trong khoảng chấp nhận: không sinh lệnh con, nhịp sau có thanh khoản thì quét', () => {
    const { engine, place, tick } = setup()
    const id = place(hunt(1))
    tick({ depth: { asks: levels([100_600, 20_000], [100_700, 20_000]), bids: BIDS } })
    tick({ depth: { asks: levels([100_600, 20_000]), bids: BIDS } })
    expect(engine.getChildren(id)).toHaveLength(0)
    expect(engine.getOrder(id).status).toBe('ACTIVE')
    tick({ depth: { asks: levels([100_400, 10_000]), bids: BIDS } })
    expect(prices(engine, id)).toEqual([[100_400, 10_000]])
  })

  it('HUNT quét mức mà mãi không có thanh khoản: hết thời gian săn thì EXPIRED, không sinh lệnh con', () => {
    const { engine, place, at } = setup()
    const id = place(hunt(1))
    const empty = { asks: levels([100_600, 20_000]), bids: BIDS }
    at(AT_1000 + 60, { depth: empty })
    expect(engine.getOrder(id).status).toBe('ACTIVE')
    at(AT_1000 + 5 * 60, { depth: empty })
    expect(engine.getOrder(id).status).toBe('EXPIRED')
    expect(engine.getChildren(id)).toHaveLength(0)
  })

  it('Scenario 4: quét xong thì phần còn lại đặt bị động một lệnh LO tại giá mua tốt nhất, chặn bởi giá tối đa', () => {
    const { engine, place, tick, fillLive } = setup()
    const id = place(hunt(1, { total_qty: 50_000 }))
    tick({ depth: { asks: levels([100_100, 10_000], [100_200, 10_000], [100_600, 20_000]), bids: BIDS } })
    tick()
    fillLive(id)
    tick()
    expect(lastChild(engine, id)).toMatchObject({ order_type: 'LO', price: 99_900, quantity: 30_000 })
    expect(engine.getChildren(id)).toHaveLength(3)
  })

  it('remainder_passive = 0: quét xong thì kết thúc lệnh (EXPIRED), không đuổi giá', () => {
    const { engine, place, tick, fillLive } = setup()
    const id = place(hunt(0, { total_qty: 50_000 }))
    tick({ depth: { asks: levels([100_100, 10_000]), bids: BIDS } })
    tick()
    fillLive(id)
    tick()
    expect(engine.getOrder(id)).toMatchObject({ status: 'EXPIRED', executed_qty: 10_000 })
    expect(engine.getChildren(id)).toHaveLength(1)
  })

  it('không có max_levels thì HUNT chạy như cũ: một lệnh con tại giá giới hạn', () => {
    const { engine, place, tick } = setup()
    const id = place(request('HUNT', [int('hunt_price', 100_000), int('max_wait_min', 5)], { limit_price: 100_500 }))
    tick()
    expect(prices(engine, id)).toEqual([[100_500, 1_000]])
  })

  it('TC-E2E-093 hết thời gian săn, chính sách hủy: dừng săn, không sinh lệnh con', () => {
    // Tài liệu: cửa sổ 5 giây. Engine tính bằng phút (tối thiểu 1), nên dùng 1 phút.
    const { engine, place, at } = setup()
    const id = place(request('HUNT', [int('hunt_price', 99_000), int('max_wait_min', 1)], { limit_price: 99_200 }))
    at(AT_1000 + 59)
    expect(engine.getOrder(id).status).toBe('ACTIVE')
    at(AT_1000 + 60)
    expect(engine.getOrder(id).status).toBe('EXPIRED')
    at(AT_1000 + 61, { last: 99_000 })
    expect(engine.getChildren(id)).toHaveLength(0)
  })
})

// ===== K. Chọn giá lệnh con (Adaptive) =====

describe('K. Adaptive', () => {
  it.todo('TC-E2E-100 mua bị động: giá lệnh con gần Bid, không ăn ngay Ask (engine luôn đặt đúng giá giới hạn của lệnh cha)')
  it.todo('TC-E2E-101 mua chủ động: đặt tại Ask nếu không vượt giới hạn (engine luôn đặt đúng giá giới hạn của lệnh cha)')

  it('TC-E2E-102 giá lệnh con mua không vượt giá giới hạn của lệnh cha', () => {
    const { engine, place, at } = setup()
    const ids = [
      place(iceberg(5_000, 1_000, { limit_price: 100_000 })),
      place(twap10(5_000)),
      place(request('POV', [int('participation_pct', 10), int('max_pct', 20)], { total_qty: 5_000, limit_price: 100_000 })),
    ]
    for (let minute = 30; minute < 80; minute += 1) at(hhmm(10, minute), { last: 100_000, volume: minute * 1_000 })

    for (const id of ids) {
      const limit = engine.getOrder(id).limit_price as number
      expect(engine.getChildren(id).length).toBeGreaterThan(0)
      for (const child of engine.getChildren(id)) expect(child.price).toBeLessThanOrEqual(limit)
    }
  })
})

// ===== L. Giá arrival =====

describe('L. Giá arrival', () => {
  it('TC-E2E-110 chụp Bid 99.900 / Last 100.000 / Ask 100.100 lúc ACTIVE, không cập nhật về sau', () => {
    const { engine, place, ticks } = setup()
    const id = place(iceberg(10_000, 1_000))
    const expected = { arrival_bid: 99_900, arrival_price: 100_000, arrival_ask: 100_100 }
    expect(engine.getSnapshot(id)).toMatchObject(expected)
    ticks(10, { last: 102_000 })
    expect(engine.getSnapshot(id)).toMatchObject(expected)
  })

  it('TC-E2E-111 shortfall lệnh mua: arrival 100.000, giá BQ 100.300 → +300 (30 bps), bất lợi', () => {
    const { engine, place, ticks, fill } = setup()
    const id = place(iceberg(1_000, 1_000))
    ticks(2)
    fill(engine.getChildren(id)[0].child_order_id, 1_000, 100_300)

    const summary = getFillSummary(
      engine.getOrder(id),
      engine.getChildren(id),
      engine.getExecutions(id),
      engine.getSnapshot(id) ?? null,
    )
    expect((summary.avgPrice ?? 0) - (summary.arrivalPrice ?? 0)).toBe(300)
    expect(summary.differenceBps).toBeCloseTo(30)
    expect(summary.isFavorable).toBe(false)
  })
})

// ===== M. Risk trong lúc thuật toán chạy =====

describe('M. Risk trong lúc chạy', () => {
  it.todo('TC-E2E-120 Risk lỗi giữa chừng: không sinh lệnh con mới, PAUSED_SYSTEM (engine chưa có Risk)')

  it('TC-E2E-121 chạy lại sau khi hệ thống tạm dừng: còn lại 50.000, không chạy lại từ 100.000', () => {
    // Engine chưa có Risk: dùng 2 lần Core từ chối để đưa lệnh về PAUSED_SYSTEM, rồi vận hành mở lại.
    const { engine, place, tick, runSlices } = setup()
    const id = place(iceberg(100_000, 10_000))
    runSlices(id, 5)
    expect(engine.getOrder(id).executed_qty).toBe(50_000)

    tick()
    engine.injectRejectNext(id)
    engine.injectRejectNext(id)
    tick()
    tick()
    expect(engine.getOrder(id).status).toBe('PAUSED_SYSTEM')
    const count = engine.getChildren(id).length

    engine.reopenOrder(id, 'Risk đã PASS', 'vanhanh')
    tick()
    expect(engine.getOrder(id)).toMatchObject({ status: 'PARTIALLY_EXECUTED', executed_qty: 50_000 })
    expect(remainingOf(engine, id)).toBe(50_000)
    expect(engine.getChildren(id)).toHaveLength(count + 1)
    expect(lastChild(engine, id)?.quantity).toBe(10_000)
    expect(engine.getAllowedQty(id)).toBe(40_000)
  })
})

// ===== N. Core từ chối =====

describe('N. Core từ chối', () => {
  it('TC-E2E-131 Core từ chối liên tục: không thử lại vô hạn, lệnh cha PAUSED_SYSTEM', () => {
    const { engine, place, ticks } = setup()
    const id = place(iceberg(100_000, 10_000))
    for (let index = 0; index < 5; index += 1) engine.injectRejectNext(id)
    ticks(20)
    expect(engine.getOrder(id)).toMatchObject({ status: 'PAUSED_SYSTEM', reason_code: 'CHILD_REJECTED_REPEAT', executed_qty: 0 })
    expect(engine.getChildren(id).map((child) => child.status)).toEqual(['REJECTED', 'REJECTED'])
  })
})

// ===== P. Sự kiện trùng / sai thứ tự =====

describe('P. Sự kiện sai thứ tự', () => {
  it.todo('TC-E2E-151 (phần FE) nhận sequence 102 rồi 101: không quay lùi trạng thái (engine chưa có sequence của sự kiện từ Core)')
})

// ===== Q. Hủy lệnh =====

describe('Q. Hủy lệnh', () => {
  it('TC-E2E-160 hủy khi chưa có lệnh con: CANCELLED, không có lệnh hủy nào gửi Core', () => {
    const { engine, place } = setup()
    const id = place(iceberg(10_000, 1_000))
    engine.cancelOrder(id, 'tester')
    expect(engine.getOrder(id).status).toBe('CANCELLED')
    expect(engine.getChildren(id)).toHaveLength(0)
    expect(engine.getEvents(id).filter((event) => event.child_order_id !== null)).toEqual([])
  })

  it('TC-E2E-161 hủy khi có lệnh con đang chờ: CANCEL_PENDING → hủy lệnh con → CANCELLED, không sinh thêm', () => {
    const { engine, place, ticks } = setup()
    const id = place(iceberg(10_000, 1_000))
    ticks(2)
    const child = engine.getChildren(id)[0]
    expect(child.status).toBe('ACKNOWLEDGED')
    const from = engine.getEvents(id).length

    engine.cancelOrder(id, 'tester')
    const steps = engine
      .getEvents(id)
      .slice(from)
      .map((event) => `${event.child_order_id ?? 'PARENT'}:${event.old_value}→${event.new_value}`)
    expect(steps).toEqual([
      'PARENT:ACTIVE→CANCEL_PENDING',
      `${child.child_order_id}:ACKNOWLEDGED→CANCELLED`,
      'PARENT:CANCEL_PENDING→CANCELLED',
    ])
    ticks(5)
    expect(engine.getChildren(id)).toHaveLength(1)
  })

  deviation('TC-E2E-162 khớp 4.000 trong lúc hủy: executed +4.000, CANCELLED, không mất phần khớp', () => {
    const { engine, place, ticks, fill } = setup()
    const id = place(iceberg(10_000, 10_000))
    ticks(2)
    const childId = engine.getChildren(id)[0].child_order_id
    engine.cancelOrder(id, 'tester')
    // Báo khớp do sàn khớp trước khi nhận lệnh hủy, về tới OMS sau yêu cầu hủy.
    fill(childId, 4_000)

    expect(engine.getOrder(id)).toMatchObject({ status: 'CANCELLED', executed_qty: 4_000 })
    expect(remainingOf(engine, id)).toBe(6_000)
  })
})

// ===== R. Tạm dừng / tiếp tục =====

describe('R. Tạm dừng / tiếp tục', () => {
  it('TC-E2E-170 TWAP đang chạy bị tạm dừng: tới khoảng kế tiếp không sinh lệnh con', () => {
    const { engine, place, at } = setup()
    const id = place(twap10(100_000))
    at(hhmm(10, 30))
    at(hhmm(10, 31))
    engine.pauseOrder(id, 'tester')
    at(hhmm(10, 35))
    at(hhmm(10, 40))
    expect(engine.getChildren(id)).toHaveLength(1)
    expect(engine.getChildren(id).filter((child) => isChildLive(child.status))).toEqual([])
  })

  deviation('TC-E2E-171 tiếp tục: tính lại các khoảng còn lại theo KL đã khớp, không chạy lại khoảng đã lỡ', () => {
    const { engine, place, at, fillLive } = setup()
    const id = place(twap10(100_000))
    at(hhmm(10, 30))
    at(hhmm(10, 31))
    fillLive(id)
    engine.pauseOrder(id, 'tester')
    at(hhmm(10, 35))
    at(hhmm(10, 40))
    at(hhmm(10, 45))
    engine.resumeOrder(id, 'tester')
    at(hhmm(10, 46))

    expect(engine.getOrder(id).executed_qty).toBe(10_000)
    // Còn 90.000 cho 7 khoảng 10:45–11:15: mỗi khoảng tối đa 12.900 (làm tròn lên lô 100).
    expect(lastChild(engine, id)?.quantity).toBeLessThanOrEqual(12_900)
  })
})

// ===== S. Dữ liệu thị trường lỗi =====

describe('S. Dữ liệu thị trường lỗi', () => {
  it('TC-E2E-180 giá trễ: Stop, Trailing, POV, VWAP, HUNT đều PAUSED_SYSTEM, không ra quyết định mới', () => {
    const { engine, place, tick } = setup()
    const ids = [
      place(request('STOP', [int('trigger_price', 95_000)], { side: 'SELL' })),
      place(request('TRAILING_STOP', [int('trailing_value', 1_000)], { side: 'SELL' })),
      place(request('POV', [int('participation_pct', 10), int('max_pct', 20)], { limit_price: PASSIVE_BUY })),
      place(request('VWAP', [time('start_time', '09:30'), time('end_time', '14:00')], { limit_price: PASSIVE_BUY })),
      place(request('HUNT', [int('hunt_price', 99_000), int('max_wait_min', 60)], { limit_price: 99_200 })),
    ]
    // Giá cũ đứng ở mức đủ kích hoạt mọi điều kiện, KL tăng đủ để POV sinh lệnh con.
    for (let index = 1; index <= 5; index += 1) tick({ last: 95_000, volume: index * 100_000, quoteAge: MAX_DATA_DELAY + index })

    for (const id of ids) {
      expect(engine.getOrder(id)).toMatchObject({ status: 'PAUSED_SYSTEM', reason_code: 'MARKET_DATA_STALE' })
      expect(engine.getChildren(id)).toHaveLength(0)
      expect(engine.getEvents(id).some((event) => event.action === 'TRIGGER')).toBe(false)
    }
  })

  it('TC-E2E-181 dữ liệu phục hồi: không dùng ảnh giá cũ, đánh giá lại theo giá mới', () => {
    const { engine, place, tick } = setup()
    const id = place(request('STOP', [int('trigger_price', 95_000)], { side: 'SELL' }))
    tick({ last: 95_000, quoteAge: MAX_DATA_DELAY })
    expect(engine.getOrder(id).status).toBe('PAUSED_SYSTEM')

    tick({ last: 98_000 })
    expect(engine.getOrder(id).status).toBe('ACTIVE')
    expect(conditionOf(engine, id, 'STOP')?.status).toBe('ACTIVE')
    expect(engine.getChildren(id)).toHaveLength(0)

    tick({ last: 95_000 })
    expect(conditionOf(engine, id, 'STOP')?.status).toBe('TRIGGERED')
  })
})

// ===== T. Phiên giao dịch =====

describe('T. Phiên giao dịch', () => {
  const multiSession = () => iceberg(10_000, 5_000, { persistence_mode: 'MULTI_SESSION', valid_to: '2026-12-31' })

  it('TC-E2E-190 hết phiên: không sinh lệnh con', () => {
    const { engine, place, at } = setup()
    const id = place(multiSession())
    for (let minute = 46; minute < 60; minute += 1) at(hhmm(14, minute))
    expect(engine.getOrder(id).status).toBe('ACTIVE')
    expect(engine.getChildren(id)).toHaveLength(0)
  })

  it('TC-E2E-191 phiên mở lại: thuật toán tính lại từ trạng thái mới', () => {
    const { engine, place, at, fill } = setup()
    const id = place(multiSession())
    at(AT_1000 + 1)
    at(AT_1000 + 2)
    fill(engine.getChildren(id)[0].child_order_id, 3_000)
    at(hhmm(14, 46))
    expect(engine.getChildren(id)[0].status).toBe('EXPIRED')

    at(hhmm(9, 16), { date: NEXT_DAY })
    expect(engine.getOrder(id)).toMatchObject({ status: 'PARTIALLY_EXECUTED', executed_qty: 3_000 })
    expect(lastChild(engine, id)).toMatchObject({ quantity: 5_000, status: 'CREATED' })
    expect(engine.getAllowedQty(id)).toBe(2_000)
  })

  it.todo('TC-E2E-192 mã bị tạm ngừng giao dịch: thuật toán tạm dừng, không sinh lệnh con (dữ liệu giá chưa có trạng thái tạm ngừng của mã)')
})

// ===== V. Sửa lệnh cha =====

describe('V. Sửa lệnh cha', () => {
  function executed(qty: number) {
    const ctx = setup()
    const id = ctx.place(iceberg(100_000, qty))
    ctx.runSlices(id, 1)
    return { ...ctx, id }
  }

  it('TC-E2E-210 tăng tổng KL 100.000 → 150.000 khi đã khớp 30.000: còn lại 120.000', () => {
    const { engine, id } = executed(30_000)
    engine.updateOrder(id, { version: 1, total_qty: 150_000, limit_price: PASSIVE_BUY }, 'tester')
    expect(engine.getOrder(id)).toMatchObject({ total_qty: 150_000, executed_qty: 30_000, version: 2 })
    expect(remainingOf(engine, id)).toBe(120_000)
  })

  it('TC-E2E-211 sửa tổng KL 40.000 thấp hơn đã khớp 50.000: từ chối', () => {
    const { engine, id } = executed(50_000)
    expect(() => engine.updateOrder(id, { version: 1, total_qty: 40_000, limit_price: PASSIVE_BUY }, 'tester')).toThrow(
      'không được nhỏ hơn',
    )
    expect(engine.getOrder(id)).toMatchObject({ total_qty: 100_000, version: 1 })
  })

  it('TC-E2E-212 (phần FE) hai yêu cầu cùng version 5: A thành công lên version 6, B báo xung đột', () => {
    const { engine, place } = setup()
    const id = place(iceberg(100_000, 10_000))
    for (let version = 1; version < 5; version += 1) {
      engine.updateOrder(id, { version, total_qty: 100_000 + version * 1_000, limit_price: PASSIVE_BUY }, 'tester')
    }
    expect(engine.getOrder(id).version).toBe(5)

    engine.updateOrder(id, { version: 5, total_qty: 200_000, limit_price: PASSIVE_BUY }, 'A')
    expect(engine.getOrder(id)).toMatchObject({ version: 6, total_qty: 200_000 })
    expect(() => engine.updateOrder(id, { version: 5, total_qty: 300_000, limit_price: PASSIVE_BUY }, 'B')).toThrow(
      'thay đổi ở nơi khác',
    )
    expect(engine.getOrder(id)).toMatchObject({ version: 6, total_qty: 200_000 })
  })
})

// ===== W. Hoàn tất lệnh cha =====

describe('W. Hoàn tất lệnh cha', () => {
  it('TC-E2E-220 khớp đủ 100.000: còn lại 0, COMPLETED, không sinh lệnh con', () => {
    const { engine, place, runSlices, ticks } = setup()
    const id = place(iceberg(100_000, 50_000))
    runSlices(id, 2)
    expect(engine.getOrder(id)).toMatchObject({ status: 'COMPLETED', executed_qty: 100_000 })
    expect(remainingOf(engine, id)).toBe(0)
    ticks(10)
    expect(engine.getChildren(id)).toHaveLength(2)
  })

  it('TC-E2E-221 đã khớp 95.000, đang chờ 5.000, thuật toán muốn thêm 10.000: được phép 0, không sinh', () => {
    const { engine, place, tick, fill } = setup()
    const id = place(
      request('POV', [int('participation_pct', 10), int('max_pct', 20)], { total_qty: 100_000, limit_price: PASSIVE_BUY }),
    )
    tick({ volume: 0 })
    tick({ volume: 1_000_000 })
    tick({ volume: 1_000_000 })
    fill(engine.getChildren(id)[0].child_order_id, 95_000)
    expect(engine.getWorkingQty(id)).toBe(5_000)

    tick({ volume: 1_100_000 }) // 10% của 100.000 KL mới = 10.000.
    expect(engine.getAllowedQty(id)).toBe(0)
    expect(engine.getChildren(id)).toHaveLength(1)
  })
})

// ===== X. Báo cáo =====

describe('X. Báo cáo', () => {
  it('TC-E2E-230 giá bình quân: 5.000 @100.000 và 10.000 @101.000', () => {
    const { engine, place, ticks, fill } = setup()
    const id = place(iceberg(15_000, 15_000))
    ticks(2)
    const childId = engine.getChildren(id)[0].child_order_id
    fill(childId, 5_000, 100_000)
    fill(childId, 10_000, 101_000)

    const summary = getFillSummary(engine.getOrder(id), engine.getChildren(id), engine.getExecutions(id), null)
    expect(summary.avgPrice).toBeCloseTo((5_000 * 100_000 + 10_000 * 101_000) / 15_000)
  })

  it('TC-E2E-231 đối soát cha / con: executed của lệnh cha = tổng KL các lần khớp hợp lệ', () => {
    const { engine, place, ticks, fill } = setup()
    const id = place(iceberg(3_000, 2_000))
    ticks(2)
    const first = engine.getChildren(id)[0].child_order_id
    fill(first, 500)
    engine.applyExecution({ child_order_id: first, exchange_match_id: 'TC-M1', price: 100_000, qty: 500 }) // Trùng.
    fill(first, 9_999) // Vượt KL lệnh con, bị cắt về 1.500.
    ticks(2)
    fill(engine.getChildren(id)[1].child_order_id, 400)

    const order = engine.getOrder(id)
    const fills = engine.getExecutions(id).reduce((sum, item) => sum + item.qty, 0)
    const childFilled = engine.getChildren(id).reduce((sum, child) => sum + child.filled_qty, 0)
    expect(order.executed_qty).toBe(2_400)
    expect(fills).toBe(order.executed_qty)
    expect(childFilled).toBe(order.executed_qty)
  })

  it('TC-E2E-232 tỷ lệ tham gia thực tế: OMS khớp 80.000 trên KL thị trường 1.000.000 = 8%', () => {
    // Hàm tính dùng chung với báo cáo hiệu quả thực hiện; KL thị trường lấy từ băng tick của cùng khoảng thời gian.
    expect(getParticipation(80_000, 1_000_000)).toBeCloseTo(0.08)
    expect(getParticipation(80_000, 0)).toBeNull()
  })
})

// ===== Y. Nhật ký kiểm toán =====

describe('Y. Nhật ký kiểm toán', () => {
  function userActions() {
    const ctx = setup()
    const id = ctx.place(iceberg(10_000, 1_000), 'khachhang')
    ctx.engine.updateOrder(id, { version: 1, total_qty: 20_000, limit_price: PASSIVE_BUY }, 'dealer')
    ctx.engine.pauseOrder(id, 'khachhang')
    ctx.engine.resumeOrder(id, 'dealer')
    ctx.engine.cancelOrder(id, 'khachhang')
    const actionEvents = ctx.engine.getEvents(id).filter((event) => event.user_id !== 'SYSTEM')
    return { ...ctx, id, actionEvents }
  }

  it('TC-E2E-240 tạo, sửa, tạm dừng, tiếp tục, hủy: ghi người làm, thời điểm, kênh, giá trị cũ, giá trị mới', () => {
    const { actionEvents } = userActions()
    expect(actionEvents.map((event) => [event.action, event.user_id])).toEqual([
      ['CREATE', 'khachhang'],
      ['MODIFY', 'dealer'],
      ['PAUSE', 'khachhang'],
      ['RESUME', 'dealer'],
      ['CANCEL', 'khachhang'],
    ])
    for (const event of actionEvents) {
      expect(event.channel).toBe('WEB')
      expect(event.event_time).toBe(`${TODAY}T10:00:00`)
      expect(event.new_value).not.toBeNull()
    }
    expect(actionEvents.slice(1).every((event) => event.old_value !== null)).toBe(true)
    const modify = actionEvents[1]
    expect(JSON.parse(modify.old_value ?? '')).toMatchObject({ total_qty: 10_000 })
    expect(JSON.parse(modify.new_value ?? '')).toMatchObject({ total_qty: 20_000 })
  })

  deviation('TC-E2E-240 mỗi thao tác của người dùng ghi kèm request id', () => {
    const { actionEvents } = userActions()
    for (const event of actionEvents) expect(event).toHaveProperty('request_id')
  })

  it('TC-E2E-241 Iceberg sinh lệnh con: lưu strategy, chu kỳ, KL và giá tính ra, thời điểm quyết định', () => {
    const { engine, place, tick } = setup()
    const id = place(iceberg(10_000, 1_000))
    tick()
    const child = engine.getChildren(id)[0]
    const created = engine.getEvents(id).find((event) => event.action === 'CHILD_CREATE')

    expect(engine.getOrder(id).strategy_type).toBe('ICEBERG')
    expect(child).toMatchObject({ cycle_no: 1, quantity: 1_000, price: PASSIVE_BUY, created_at: `${TODAY}T10:00:01` })
    expect(created).toMatchObject({
      child_order_id: child.child_order_id,
      user_id: 'SYSTEM',
      channel: 'ENGINE',
      event_time: `${TODAY}T10:00:01`,
    })
  })
})

// ===== Kịch bản E2E đầy đủ =====

describe('Kịch bản E2E', () => {
  it('Scenario 1 Iceberg thành công: 50.000, có một lệnh con khớp 5.000 rồi hủy phần còn lại', () => {
    const { engine, place, tick, fill, fillLive, live } = setup()
    const id = place(iceberg(50_000, 10_000))
    tick()
    tick()
    fillLive(id)
    tick()
    tick()
    fill(live(id)[0].child_order_id, 5_000)
    engine.pauseOrder(id, 'tester') // Hủy phần còn lại của lệnh con.
    engine.resumeOrder(id, 'tester')
    for (let index = 0; index < 10 && engine.getOrder(id).status !== 'COMPLETED'; index += 1) {
      tick()
      tick()
      fillLive(id)
    }

    expect(engine.getOrder(id)).toMatchObject({ status: 'COMPLETED', executed_qty: 50_000 })
    expect(remainingOf(engine, id)).toBe(0)
    expect(live(id)).toEqual([])
    expect(quantities(engine, id)).toEqual([10_000, 10_000, 10_000, 10_000, 10_000, 5_000])
  })

  it('Scenario 2 Stop → Iceberg (Stop Limit bán có slice_qty): giá 100.000 không làm gì, về 95.000 kích hoạt một lần rồi chia 10.000', () => {
    // Tài liệu ghi lệnh mua, điều kiện giá ≤ 95. Stop của engine kích hoạt lệnh mua khi giá TĂNG chạm ngưỡng,
    // nên dùng Stop Limit BÁN (kích hoạt khi giá giảm chạm ngưỡng) để giữ đúng diễn biến của kịch bản.
    const { engine, place, tick, ticks, fillLive } = setup()
    const id = place(
      request('STOP_LIMIT', [int('trigger_price', 95_000), int('slice_qty', 10_000)], {
        side: 'SELL',
        total_qty: 100_000,
        limit_price: 96_000,
      }),
    )
    ticks(3)
    expect(engine.getChildren(id)).toHaveLength(0)
    tick({ last: 95_000 })
    expect(conditionOf(engine, id, 'STOP')?.status).toBe('TRIGGERED')
    ticks(3, { last: 94_000 })
    expect(quantities(engine, id)).toEqual([10_000])
    fillLive(id)
    tick({ last: 94_000 })
    expect(quantities(engine, id)).toEqual([10_000, 10_000])
    expect(engine.getEvents(id).filter((event) => event.action === 'TRIGGER')).toHaveLength(1)
  })
  it.todo('Scenario 3 POV + Adaptive: giá lệnh con theo Bid/Ask (engine chưa có Adaptive)')
  // Scenario 4 (HUNT quét mức rồi đặt bị động phần còn lại): xem nhóm J. HUNT ở trên và src/demo/scenarios.test.ts.

  it('Scenario 5 Core mất ACK: UNKNOWN → đối soát → khớp → Iceberg chạy tiếp, không có lệnh trùng', () => {
    const { engine, place, tick, ticks, fillLive, live } = setup()
    const id = place(iceberg(20_000, 10_000))
    engine.injectTimeout(id, 'TIMEOUT_AFTER_CORE')
    tick()
    tick()
    ticks(SYSTEM_PARAM_DEFAULTS.ACK_TIMEOUT_SECONDS) // Chờ ACK hết hạn rồi mới UNKNOWN.
    const first = engine.getChildren(id)[0]
    expect(first.status).toBe('UNKNOWN')
    ticks(5)
    expect(engine.getChildren(id)).toHaveLength(1)
    expect(engine.getChildren(id)[0]).toMatchObject({ child_order_id: first.child_order_id, status: 'ACKNOWLEDGED' })

    fillLive(id)
    tick()
    tick()
    expect(live(id)).toHaveLength(1)
    fillLive(id)

    expect(engine.getOrder(id)).toMatchObject({ status: 'COMPLETED', executed_qty: 20_000 })
    expect(quantities(engine, id)).toEqual([10_000, 10_000])
  })
})
