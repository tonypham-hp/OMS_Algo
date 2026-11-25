import type { SymbolQuote } from '@/types'

export type PriceLevel = 'ceiling' | 'up' | 'ref' | 'down' | 'floor'

/** Màu chữ theo mức giá (dùng được cho cả ô bảng, cột +/-, %). */
export const PRICE_COLOR: Record<PriceLevel, string> = {
  ceiling: 'text-price-ceiling',
  up: 'text-price-up',
  ref: 'text-price-ref',
  down: 'text-price-down',
  floor: 'text-price-floor',
}

/**
 * Lớp đặt lên CHÍNH con số giá (span nội dòng, không đặt lên cả ô): giá tham chiếu chữ đậm, theme sáng thêm chip vàng nhạt
 * (index.css, token --price-ref-chip-bg), vì chữ vàng trên nền trắng khó nhận ra là "vàng".
 */
export function priceChipClass(level: PriceLevel): string {
  return level === 'ref' ? 'price-ref' : ''
}

/** Vị trí của giá so với trần / tham chiếu / sàn. */
export function getPriceLevel(price: number, quote: Pick<SymbolQuote, 'ceiling_price' | 'floor_price' | 'ref_price'>): PriceLevel {
  if (price >= quote.ceiling_price) return 'ceiling'
  if (price <= quote.floor_price) return 'floor'
  if (price > quote.ref_price) return 'up'
  if (price < quote.ref_price) return 'down'
  return 'ref'
}

/** Quy ước VN (thông lệ thị trường): trần tím, tăng xanh lá, tham chiếu vàng, giảm đỏ, sàn xanh lam. */
export function getPriceColor(price: number, quote: SymbolQuote): string {
  return PRICE_COLOR[getPriceLevel(price, quote)]
}
