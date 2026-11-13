import { describe, expect, it } from 'vitest'
import { STRATEGY_TEMPLATES } from '@/config/strategyTemplates'
import { DEFAULT_ORDER_RULES } from '@/config/systemParams'
import { validateOrderValues, type OrderFormValues } from '@/pages/PlaceOrder/orderSchema'
import type { SymbolQuote } from '@/types'
import { getCeilingPrice, getFloorPrice, isValidTick } from './hose'
import { applyTemplate, describeTemplateParams, getVisibleTemplates } from './strategyTemplates'

const hhmm = (hour: number, minute: number) => hour * 3600 + minute * 60

function quoteOf(ref: number, last = ref, tick = 100): SymbolQuote {
  return {
    symbol: 'TEST',
    ref_price: ref,
    ceiling_price: getCeilingPrice(ref),
    floor_price: getFloorPrice(ref),
    last_price: last,
    indicative_price: null,
    last_qty: 0,
    total_volume: 0,
    bid_price: last - tick,
    ask_price: last + tick,
    tick_direction: 0,
  }
}

function toForm(templateId: string, quote: SymbolQuote, now: number): OrderFormValues {
  const template = STRATEGY_TEMPLATES.find((item) => item.id === templateId)
  if (!template) throw new Error(templateId)
  const applied = applyTemplate(template, quote, now)
  return {
    account_no: '058C000001',
    symbol: quote.symbol,
    side: applied.side ?? 'BUY',
    strategy_type: applied.strategy_type,
    total_qty: applied.total_qty,
    persistence_mode: 'DAY',
    valid_to: '',
    ...(applied.values as Partial<OrderFormValues>),
  }
}

const validate = (values: OrderFormValues, quote: SymbolQuote) =>
  validateOrderValues(values, { getQuote: () => quote, today: '2026-11-13', orderRules: DEFAULT_ORDER_RULES })

describe('mẫu chiến lược', () => {
  it('có ít nhất 6 mẫu, đủ các loại yêu cầu, mô tả là một câu tiếng Việt', () => {
    expect(STRATEGY_TEMPLATES.length).toBeGreaterThanOrEqual(6)
    const types = STRATEGY_TEMPLATES.map((template) => template.strategy_type)
    for (const type of ['ICEBERG', 'TWAP', 'POV', 'VWAP', 'HUNT']) expect(types).toContain(type)
    expect(types.some((type) => type === 'STOP' || type === 'TRAILING_STOP')).toBe(true)
    expect(new Set(STRATEGY_TEMPLATES.map((template) => template.id)).size).toBe(STRATEGY_TEMPLATES.length)
    for (const template of STRATEGY_TEMPLATES) {
      expect(template.description.trim().endsWith('.')).toBe(true)
      expect(template.description.split('. ').length).toBe(1)
    }
  })

  // Ba vùng bước giá, nhiều thời điểm trong ngày (kể cả sát giờ đóng cửa), giá sát trần.
  const quotes = [quoteOf(8_000, 8_000, 10), quoteOf(27_500, 27_600, 50), quoteOf(118_000), quoteOf(100_000, 107_000)]
  const times = [hhmm(9, 10), hhmm(10, 0), hhmm(13, 30), hhmm(14, 40), hhmm(15, 0)]

  it.each(STRATEGY_TEMPLATES.map((template) => [template.id]))('%s: điền ra tham số hợp lệ theo luật HOSE', (id) => {
    for (const quote of quotes) {
      for (const now of times) {
        const values = toForm(id, quote, now)
        expect(validate(values, quote), `${id} @${quote.ref_price} ${now}`).toEqual([])
        for (const name of ['limit_price', 'trigger_price', 'hunt_price'] as const) {
          const price = values[name]
          if (price !== undefined) {
            expect(isValidTick(price)).toBe(true)
            expect(price).toBeLessThanOrEqual(quote.ceiling_price)
            expect(price).toBeGreaterThanOrEqual(quote.floor_price)
          }
        }
        if (values.total_qty !== undefined) expect(values.total_qty % 100).toBe(0)
      }
    }
  })

  it('chỉ điền các ô thuộc loại lệnh của mẫu', () => {
    const values = toForm('stop-loss-trailing', quotes[2], hhmm(10, 0))
    expect(values.trailing_value).toBe(300)
    expect(values.limit_price).toBeUndefined()
  })

  it('sửa tay sau khi chọn mẫu vẫn bị kiểm tra như cũ', () => {
    const quote = quotes[2]
    const iceberg = toForm('iceberg-quiet', quote, hhmm(10, 0))
    expect(validate({ ...iceberg, limit_price: 118_050 }, quote).map((error) => error.field)).toContain('limit_price')
    expect(validate({ ...iceberg, total_qty: 150 }, quote).map((error) => error.field)).toContain('total_qty')
    const hunt = toForm('hunt-liquidity', quote, hhmm(10, 0))
    expect(validate({ ...hunt, max_levels: 5 }, quote).map((error) => error.field)).toContain('max_levels')
    expect(validate({ ...hunt, limit_price: (hunt.hunt_price as number) - 100 }, quote).map((error) => error.field)).toContain('limit_price')
    const pov = toForm('pov-10', quote, hhmm(10, 0))
    expect(validate({ ...pov, participation_pct: 60 }, quote).length).toBeGreaterThan(0)
  })

  it('vai trò không được thấy mẫu thì không hiện', () => {
    const customer = getVisibleTemplates('CUSTOMER').map((template) => template.id)
    expect(customer).not.toContain('hunt-liquidity')
    expect(customer).not.toContain('pov-10')
    expect(customer).not.toContain('vwap-day')
    expect(customer).toContain('iceberg-quiet')
    expect(getVisibleTemplates('DEALER').map((template) => template.id)).toContain('hunt-liquidity')
    expect(getVisibleTemplates(undefined).every((template) => !template.roles)).toBe(true)
  })

  it('loại lệnh đang tắt thì mẫu của loại đó không hiện', () => {
    const visible = getVisibleTemplates('OPS', ['ICEBERG', 'TWAP'])
    expect(visible.map((template) => template.strategy_type).sort()).toEqual(['ICEBERG', 'TWAP'])
  })

  it('mô tả tham số mặc định: có giá thì ra số, không có giá thì mô tả tương đối', () => {
    const template = STRATEGY_TEMPLATES.find((item) => item.id === 'hunt-liquidity')
    if (!template) throw new Error('missing')
    expect(describeTemplateParams(template).find((row) => row.label === 'Giá săn')?.value).toBe('giá khớp')
    expect(describeTemplateParams(template, quotes[2], hhmm(10, 0)).find((row) => row.label === 'Giá săn')?.value).toBe('118.000 đ')
  })
})
