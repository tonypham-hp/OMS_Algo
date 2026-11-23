import type { SymbolQuote } from '@/types'

/** Trạng thái giao dịch của mã: Tạm ngừng → Khớp định kỳ sau tạm ngừng → Bình thường (Đợt 8B). */
export function haltStatusOf(quote: Pick<SymbolQuote, 'halt'>): { label: string; className: string } {
  if (quote.halt?.status === 'HALTED') return { label: 'Tạm ngừng', className: 'bg-red-500/20 text-red-300' }
  if (quote.halt?.status === 'REOPEN') return { label: 'Khớp định kỳ sau tạm ngừng', className: 'bg-amber-500/20 text-amber-300' }
  return { label: 'Bình thường', className: 'bg-green-500/20 text-green-300' }
}
