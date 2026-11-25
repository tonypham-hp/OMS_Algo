import type { SymbolQuote } from '@/types'

export const PRICE_COLOR = {
  ceiling: 'text-price-ceiling',
  up: 'text-price-up',
  // `price-ref`: theme sáng thêm chip vàng nhạt và chữ đậm (index.css), vì chữ vàng trên nền trắng khó thấy là "vàng".
  ref: 'text-price-ref price-ref',
  down: 'text-price-down',
  floor: 'text-price-floor',
} as const

/** Quy ước VN: trần tím, tăng xanh lá, tham chiếu vàng, giảm đỏ, sàn xanh lam. */
export function getPriceColor(price: number, quote: SymbolQuote): string {
  if (price >= quote.ceiling_price) return PRICE_COLOR.ceiling
  if (price <= quote.floor_price) return PRICE_COLOR.floor
  if (price > quote.ref_price) return PRICE_COLOR.up
  if (price < quote.ref_price) return PRICE_COLOR.down
  return PRICE_COLOR.ref
}
