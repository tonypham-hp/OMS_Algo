import { getPriceColor, getPriceLevel } from '@/config/priceColors'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { SymbolQuote } from '@/types'
import { getDisplayPrice } from '@/utils/hose'
import { PriceMark } from './PriceDirection'

/**
 * Ô giá khớp (hoặc giá dự kiến trong ATO, ATC), kèm ký hiệu so tham chiếu (▲ ▼ T S).
 * Giá vừa đổi: nền nhạt (--price-flash-*) và mũi tên ↑/↓ theo chiều bước giá, mờ dần trong 600ms;
 * tắt khi hệ thống giảm chuyển động hoặc người dùng tắt nhấp nháy trong Cài đặt (index.css).
 * `key` đổi theo giá nên React tạo lại thẻ span, nhờ đó hiệu ứng CSS chạy lại từ đầu.
 */
export function PriceCell({ quote }: { quote: SymbolQuote }) {
  const price = getDisplayPrice(quote)
  const flash = quote.tick_direction > 0 ? 'flash-up' : quote.tick_direction < 0 ? 'flash-down' : undefined

  return (
    <span key={price} className={cn('inline-block rounded px-1 font-semibold tabular-nums', getPriceColor(price, quote), flash)}>
      {flash && (
        <span aria-hidden className="flash-tick mr-0.5 text-[0.8em]">
          {quote.tick_direction > 0 ? '↑' : '↓'}
        </span>
      )}
      {formatNumber(price)}
      <PriceMark level={getPriceLevel(price, quote)} />
    </span>
  )
}
