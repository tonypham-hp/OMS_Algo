import { getPriceColor } from '@/config/priceColors'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { SymbolQuote } from '@/types'
import { getDisplayPrice } from '@/utils/hose'

/**
 * Ô giá khớp (hoặc giá dự kiến trong ATO, ATC), nháy màu khi giá đổi.
 * `key` đổi theo giá nên React tạo lại thẻ span, nhờ đó hiệu ứng CSS chạy lại từ đầu.
 */
export function PriceCell({ quote }: { quote: SymbolQuote }) {
  const price = getDisplayPrice(quote)
  const flash =
    quote.tick_direction > 0 ? 'flash-up' : quote.tick_direction < 0 ? 'flash-down' : undefined

  return (
    <span
      key={price}
      className={cn(
        'inline-block rounded px-1 font-semibold tabular-nums',
        getPriceColor(price, quote),
        flash,
      )}
    >
      {formatNumber(price)}
    </span>
  )
}
