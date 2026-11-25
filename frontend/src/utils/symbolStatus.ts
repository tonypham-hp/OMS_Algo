import type { SymbolQuote } from '@/types'

/** Trạng thái giao dịch của mã: Tạm ngừng → Khớp định kỳ sau tạm ngừng → Bình thường (Đợt 8B). */
export function haltStatusOf(quote: Pick<SymbolQuote, 'halt'>): { label: string; className: string } {
  if (quote.halt?.status === 'HALTED') return { label: 'Tạm ngừng', className: 'bg-status-danger-bg text-status-danger' }
  if (quote.halt?.status === 'REOPEN') return { label: 'Khớp định kỳ sau tạm ngừng', className: 'bg-status-warning-bg text-status-warning' }
  return { label: 'Bình thường', className: 'bg-status-success-bg text-status-success' }
}
