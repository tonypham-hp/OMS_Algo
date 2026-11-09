import { describe, expect, it } from 'vitest'
import type { StrategyType, SymbolQuote } from '@/types'
import {
  fromCreateOrderRequest,
  toCreateOrderRequest,
  validateOrderValues,
  type OrderFormValues,
  type OrderValidationContext,
} from './orderSchema'

// Tham chiếu 100.000: trần 107.000, sàn 93.000, bước 100. Giá khớp đang là 100.000.
const QUOTE: SymbolQuote = {
  symbol: 'FPT',
  ref_price: 100_000,
  ceiling_price: 107_000,
  floor_price: 93_000,
  last_price: 100_000,
  indicative_price: null,
  last_qty: 0,
  total_volume: 0,
  bid_price: 99_900,
  ask_price: 100_100,
  tick_direction: 0,
}

const CONTEXT: OrderValidationContext = {
  getQuote: (symbol) => (symbol === 'FPT' ? QUOTE : undefined),
  today: '2026-11-06',
}

function order(
  strategy_type: StrategyType,
  extra: Partial<OrderFormValues> = {},
  side: OrderFormValues['side'] = 'BUY',
): OrderFormValues {
  return {
    account_no: '058C123456',
    symbol: 'FPT',
    side,
    strategy_type,
    total_qty: 1_000,
    persistence_mode: 'DAY',
    ...extra,
  }
}

function errorFields(values: OrderFormValues) {
  return validateOrderValues(values, CONTEXT).map((error) => error.field)
}

describe('lệnh hợp lệ của từng loại', () => {
  const validOrders: Array<[StrategyType, Partial<OrderFormValues>]> = [
    ['STOP', { trigger_price: 101_000 }],
    ['STOP_LIMIT', { trigger_price: 101_000, limit_price: 101_500 }],
    ['TAKE_PROFIT', { trigger_price: 99_000, limit_price: 99_500 }],
    ['TRAILING_STOP', { trailing_value: 1_000 }],
    ['OCO', { tp_price: 98_000, sl_price: 102_000 }],
    ['BRACKET', { limit_price: 100_000, tp_price: 104_000, sl_price: 97_000 }],
    ['ICEBERG', { slice_qty: 200, limit_price: 100_000 }],
    ['TWAP', { start_time: '09:30', end_time: '11:00', interval_min: 5, limit_price: 100_000 }],
    ['VWAP', { start_time: '09:30', end_time: '11:00', limit_price: 100_000 }],
    ['POV', { participation_pct: 10, max_pct: 20, limit_price: 100_000 }],
    ['HUNT', { hunt_price: 98_000, max_wait_min: 30, limit_price: 98_500 }],
  ]

  it.each(validOrders)('%s không có lỗi', (strategy, extra) => {
    expect(validateOrderValues(order(strategy, extra), CONTEXT)).toEqual([])
  })
})

describe('trường chung', () => {
  it('báo thiếu khối lượng và tham số bắt buộc cùng lúc', () => {
    const fields = errorFields(order('STOP_LIMIT', { total_qty: undefined }))
    expect(fields).toEqual(expect.arrayContaining(['total_qty', 'trigger_price', 'limit_price']))
  })

  it('kiểm tra khối lượng theo luật HOSE', () => {
    expect(errorFields(order('TRAILING_STOP', { total_qty: 150, trailing_value: 1_000 }))).toEqual(['total_qty'])
    expect(errorFields(order('TRAILING_STOP', { total_qty: 500_100, trailing_value: 1_000 }))).toEqual(['total_qty'])
  })

  it('báo mã không tồn tại', () => {
    expect(errorFields(order('TRAILING_STOP', { symbol: 'XXX', trailing_value: 1_000 }))).toEqual(['symbol'])
  })

  it('GTD cần ngày hết hạn không ở quá khứ', () => {
    const base = { trailing_value: 1_000, persistence_mode: 'GTD' as const }
    expect(errorFields(order('TRAILING_STOP', base))).toEqual(['valid_to'])
    expect(errorFields(order('TRAILING_STOP', { ...base, valid_to: '2026-11-05' }))).toEqual(['valid_to'])
    expect(errorFields(order('TRAILING_STOP', { ...base, valid_to: '2026-11-06' }))).toEqual([])
  })
})

describe('kiểm tra giá trên tham số', () => {
  it('từ chối giá vượt trần và sai bước', () => {
    expect(errorFields(order('ICEBERG', { slice_qty: 200, limit_price: 107_100 }))).toEqual(['limit_price'])
    expect(errorFields(order('ICEBERG', { slice_qty: 200, limit_price: 100_050 }))).toEqual(['limit_price'])
  })

  it('trường đã sai giá thì không báo thêm lỗi so sánh', () => {
    const errors = validateOrderValues(order('STOP', { trigger_price: 90_000 }), CONTEXT)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain('sàn')
  })
})

describe('quan hệ giá theo chiều lệnh', () => {
  it('Stop mua phải kích hoạt trên giá khớp, Stop bán dưới giá khớp', () => {
    expect(errorFields(order('STOP', { trigger_price: 99_000 }))).toEqual(['trigger_price'])
    expect(errorFields(order('STOP', { trigger_price: 99_000 }, 'SELL'))).toEqual([])
    expect(errorFields(order('STOP', { trigger_price: 101_000 }, 'SELL'))).toEqual(['trigger_price'])
  })

  it('Take Profit ngược chiều với Stop', () => {
    const values = { trigger_price: 101_000, limit_price: 100_500 }
    expect(errorFields(order('TAKE_PROFIT', values, 'SELL'))).toEqual([])
    expect(errorFields(order('TAKE_PROFIT', values, 'BUY'))).toContain('trigger_price')
  })

  it('giá giới hạn phải đủ để khớp sau khi kích hoạt', () => {
    expect(errorFields(order('STOP_LIMIT', { trigger_price: 101_000, limit_price: 100_500 }))).toEqual(['limit_price'])
  })

  it('OCO đặt TP và SL ở hai phía giá khớp', () => {
    expect(errorFields(order('OCO', { tp_price: 102_000, sl_price: 98_000 }, 'SELL'))).toEqual([])
    expect(errorFields(order('OCO', { tp_price: 98_000, sl_price: 102_000 }, 'SELL'))).toEqual(['tp_price', 'sl_price'])
  })

  it('Bracket đặt TP và SL ở hai phía giá vào', () => {
    expect(errorFields(order('BRACKET', { limit_price: 100_000, tp_price: 97_000, sl_price: 104_000 }))).toEqual(['tp_price', 'sl_price'])
    expect(errorFields(order('BRACKET', { limit_price: 100_000, tp_price: 97_000, sl_price: 104_000 }, 'SELL'))).toEqual([])
  })

  it('HUNT: giá giới hạn không tệ hơn giá săn', () => {
    expect(errorFields(order('HUNT', { hunt_price: 98_000, max_wait_min: 30, limit_price: 97_000 }))).toEqual(['limit_price'])
  })
})

describe('tham số thuật toán', () => {
  it('Iceberg: slice là bội số 100 và không lớn hơn KL', () => {
    expect(errorFields(order('ICEBERG', { slice_qty: 150, limit_price: 100_000 }))).toEqual(['slice_qty'])
    expect(errorFields(order('ICEBERG', { slice_qty: 1_100, limit_price: 100_000 }))).toEqual(['slice_qty'])
  })

  it('TWAP: giờ trong phiên, bắt đầu trước kết thúc, chu kỳ không quá dài', () => {
    const base = { interval_min: 5, limit_price: 100_000 }
    expect(errorFields(order('TWAP', { ...base, start_time: '08:00', end_time: '11:00' }))).toEqual(['start_time'])
    expect(errorFields(order('TWAP', { ...base, start_time: '11:00', end_time: '10:00' }))).toEqual(['end_time'])
    expect(errorFields(order('TWAP', { ...base, interval_min: 120, start_time: '10:00', end_time: '11:00' }))).toEqual(['interval_min'])
  })

  it('POV: tham gia không lớn hơn tối đa, trong khoảng 1 đến 100', () => {
    expect(errorFields(order('POV', { participation_pct: 30, max_pct: 20, limit_price: 100_000 }))).toEqual(['participation_pct'])
    expect(errorFields(order('POV', { participation_pct: 10, max_pct: 101, limit_price: 100_000 }))).toEqual(['max_pct'])
  })

  it('Trailing: khoảng trượt là bội số bước giá', () => {
    expect(errorFields(order('TRAILING_STOP', { trailing_value: 150 }))).toEqual(['trailing_value'])
    expect(errorFields(order('TRAILING_STOP', { trailing_value: 0 }))).toEqual(['trailing_value'])
  })
})

describe('đổi sang dữ liệu API', () => {
  it('chỉ gửi tham số của loại lệnh đang chọn, bỏ giá trị còn sót khi đổi loại', () => {
    const request = toCreateOrderRequest(
      order('STOP', { trigger_price: 101_000, limit_price: 100_000, slice_qty: 200 }),
      'req-1',
    )
    expect(request.limit_price).toBeNull()
    expect(request.parameters).toEqual([
      { parameter_code: 'trigger_price', parameter_value: '101000', data_type: 'INTEGER' },
    ])
  })

  it('đổi đi rồi đổi lại vẫn hợp lệ, gồm cả trường giờ', () => {
    const values = order('TWAP', { start_time: '09:30', end_time: '11:00', interval_min: 5, limit_price: 100_000 })
    const roundTrip = fromCreateOrderRequest(toCreateOrderRequest(values, 'req-2'))
    expect(roundTrip).toMatchObject({ start_time: '09:30', end_time: '11:00', interval_min: 5, limit_price: 100_000 })
    expect(validateOrderValues(roundTrip, CONTEXT)).toEqual([])
  })

  it('lệnh trong ngày không gửi ngày hết hạn', () => {
    const request = toCreateOrderRequest(order('TRAILING_STOP', { trailing_value: 1_000, valid_to: '2026-12-01' }), 'req-3')
    expect(request.valid_to).toBeNull()
  })
})

describe('luật đặt lệnh từ cấu hình hệ thống', () => {
  const rules = { enabledStrategies: ['TWAP', 'ICEBERG', 'POV'] as StrategyType[], povMaxPct: 20, icebergMinSlice: 500, icebergMaxSlice: 2_000 }
  const fields = (values: OrderFormValues) =>
    validateOrderValues(values, { ...CONTEXT, orderRules: rules }).map((error) => error.field)

  it('loại lệnh đang tắt thì báo lỗi ở ô loại lệnh', () => {
    expect(fields(order('STOP', { trigger_price: 101_000 }))).toEqual(['strategy_type'])
    expect(
      validateOrderValues(order('STOP', { trigger_price: 101_000 }), { ...CONTEXT, orderRules: rules })[0].message,
    ).toBe('Loại lệnh Stop đang tạm ngừng, chưa đặt mới được')
  })

  it('Iceberg: KL mỗi phần phải nằm trong khoảng tối thiểu, tối đa', () => {
    expect(fields(order('ICEBERG', { slice_qty: 400, limit_price: 100_000 }))).toEqual(['slice_qty'])
    expect(fields(order('ICEBERG', { slice_qty: 500, limit_price: 100_000 }))).toEqual([])
    expect(fields(order('ICEBERG', { slice_qty: 2_100, limit_price: 100_000 }, 'BUY'))).toEqual(['slice_qty'])
  })

  it('Iceberg: lỗi luật HOSE của ô đã có thì không báo thêm lỗi cấu hình', () => {
    const errors = validateOrderValues(order('ICEBERG', { slice_qty: 150, limit_price: 100_000 }), { ...CONTEXT, orderRules: rules })
    expect(errors).toEqual([{ field: 'slice_qty', message: 'Khối lượng phải là bội số của 100' }])
  })

  it('POV: tỷ lệ tham gia và tỷ lệ tối đa không vượt trần hệ thống', () => {
    expect(fields(order('POV', { participation_pct: 10, max_pct: 30, limit_price: 100_000 }))).toEqual(['max_pct'])
    expect(fields(order('POV', { participation_pct: 25, max_pct: 30, limit_price: 100_000 }))).toEqual(['participation_pct', 'max_pct'])
    expect(fields(order('POV', { participation_pct: 10, max_pct: 20, limit_price: 100_000 }))).toEqual([])
  })

  it('không truyền luật thì dùng mặc định: mọi loại lệnh được bật', () => {
    expect(validateOrderValues(order('STOP', { trigger_price: 101_000 }), CONTEXT)).toEqual([])
  })
})
