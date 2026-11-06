import { getPriceColor } from '@/config/priceColors'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { SymbolQuote } from '@/types'

/**
 * Ô giá khớp, nháy màu khi giá đổi.
 * `key` đổi theo giá nên React tạo lại thẻ span, nhờ đó hiệu ứng CSS chạy lại từ đầu.
 */
export function PriceCell({ quote }: { quote: SymbolQuote }) {
  const flash =
    quote.tick_direction > 0 ? 'flash-up' : quote.tick_direction < 0 ? 'flash-down' : undefined

  return (
    <span
      key={quote.last_price}
      className={cn(
        'inline-block rounded px-1 font-semibold tabular-nums',
        getPriceColor(quote.last_price, quote),
        flash,
      )}
    >
      {formatNumber(quote.last_price)}
    </span>
  )
}
