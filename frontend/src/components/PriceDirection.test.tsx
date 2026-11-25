import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { getPriceColor, getPriceLevel } from '@/config/priceColors'
import { PriceMark } from './PriceDirection'

const quote = { ceiling_price: 107_000, floor_price: 93_000, ref_price: 100_000 }

describe('getPriceLevel', () => {
  it('trần/sàn ưu tiên hơn tăng/giảm, bằng tham chiếu là ref', () => {
    expect(getPriceLevel(107_000, quote)).toBe('ceiling')
    expect(getPriceLevel(101_000, quote)).toBe('up')
    expect(getPriceLevel(100_000, quote)).toBe('ref')
    expect(getPriceLevel(99_000, quote)).toBe('down')
    expect(getPriceLevel(93_000, quote)).toBe('floor')
  })

  it('màu theo cùng mức; tham chiếu có lớp chip cho theme sáng', () => {
    expect(getPriceColor(107_000, quote as never)).toBe('text-price-ceiling')
    expect(getPriceColor(100_000, quote as never)).toContain('price-ref')
  })
})

describe('PriceMark: không chỉ dựa vào màu', () => {
  it('trần "T" và sàn "S" có tên đọc', () => {
    expect(renderToStaticMarkup(<PriceMark level="ceiling" />)).toMatch(/role="img" aria-label="Giá trần"[^>]*>T</)
    expect(renderToStaticMarkup(<PriceMark level="floor" />)).toMatch(/role="img" aria-label="Giá sàn"[^>]*>S</)
  })

  it('tăng ▲ / giảm ▼, mũi tên ẩn với trình đọc màn hình nhưng có chữ thay thế', () => {
    const up = renderToStaticMarkup(<PriceMark level="up" />)
    expect(up).toContain('<span aria-hidden="true">▲</span>')
    expect(up).toContain('tăng')
    expect(renderToStaticMarkup(<PriceMark level="down" />)).toContain('▼')
  })

  it('tham chiếu: không ký hiệu', () => {
    expect(renderToStaticMarkup(<PriceMark level="ref" />)).toBe('')
  })
})
