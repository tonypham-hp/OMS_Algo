import { Badge } from '@/components/ui/badge'
import { formatClock } from '@/lib/format'
import { useMarketStore } from '@/store/market.store'
import type { SymbolQuote } from '@/types'
import { haltStatusOf } from '@/utils/symbolStatus'

const STATUS_LABELS: Record<string, { label: string; title: string; className: string }> = {
  RESTRICTED: {
    label: 'Hạn chế GD',
    title: 'Mã bị hạn chế giao dịch: chỉ khớp định kỳ (ATO, các lượt 15 phút, ATC), chỉ lô chẵn, chỉ LO trong lượt.',
    className: 'bg-status-warning-bg text-status-warning',
  },
}

/**
 * Nhãn trạng thái giao dịch của mã: hạn chế giao dịch, tạm ngừng, khớp định kỳ sau tạm ngừng.
 * Mã bình thường không hiện gì.
 */
export function SymbolStatusBadge({ quote }: { quote: Pick<SymbolQuote, 'symbol' | 'trading_status' | 'halt'> | undefined }) {
  if (!quote) return null
  const restricted = quote.trading_status ? STATUS_LABELS[quote.trading_status] : undefined
  const halt = quote.halt ? haltStatusOf(quote) : undefined
  if (!restricted && !halt) return null
  return (
    <span className="inline-flex items-center gap-1">
      {restricted && (
        <Badge className={restricted.className} title={restricted.title} data-demo-id={`symbol-status-${quote.symbol}`}>
          {restricted.label}
        </Badge>
      )}
      {halt && (
        <Badge className={halt.className} data-demo-id={`halt-status-${quote.symbol}`}>
          {halt.label}
        </Badge>
      )}
    </span>
  )
}

/** "Khớp kế tiếp 09:45 · còn 07:12" cho mã đang trong phiên định kỳ riêng (mã hạn chế). */
export function CallCountdown({ symbol, className }: { symbol: string; className?: string }) {
  const callEnd = useMarketStore((state) => state.quotes.find((quote) => quote.symbol === symbol)?.phase?.call_end ?? null)
  const locked = useMarketStore((state) => state.quotes.find((quote) => quote.symbol === symbol)?.phase?.session === 'PERIODIC_LOCK')
  const now = useMarketStore((state) => state.sim_seconds)
  if (callEnd === null || callEnd <= now) return null
  const left = Math.max(0, Math.floor(callEnd - now))
  const remaining = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`
  return (
    <p role="status" className={className} data-demo-id={`call-countdown-${symbol}`}>
      Khớp kế tiếp <span className="font-medium tabular-nums">{formatClock(callEnd).slice(0, 5)}</span> · còn{' '}
      <span className="tabular-nums">{remaining}</span>
      {locked && <span className="text-amber-300"> · đang khóa sửa/hủy</span>}
    </p>
  )
}
