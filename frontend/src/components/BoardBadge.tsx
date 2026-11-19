import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { defaultRules } from '@/rules/registry'
import { boardLabel } from '@/rules/symbols'
import type { SymbolQuote } from '@/types'

/**
 * Nhãn sàn cạnh mã: HOSE / HNX / UPCoM theo bảng giao dịch của mã trong ngày mô phỏng.
 * Mã đã chuyển sàn có thêm nhãn "Giả định" (luật bảng mới chưa kiểm chứng); mã ngừng giao dịch hiện "Ngừng GD".
 */
export function BoardBadge({ quote, className }: { quote: Pick<SymbolQuote, 'symbol' | 'board' | 'transferred'>; className?: string }) {
  const assumed = quote.transferred ? defaultRules().flags.TRANSFERRED_SYMBOL_RULES : undefined
  return (
    <span className={cn('inline-flex items-center gap-1', className)} data-demo-id={`board-badge-${quote.symbol}`}>
      <Badge variant={quote.board === null ? 'destructive' : 'outline'} aria-label={`Sàn của ${quote.symbol}`}>
        {boardLabel(quote.board === undefined ? 'STO' : quote.board)}
      </Badge>
      {assumed && (
        <Badge variant="secondary" title={assumed.note}>
          {assumed.label}
        </Badge>
      )}
    </span>
  )
}
