import type { PriceLevel } from '@/config/priceColors'
import { cn } from '@/lib/utils'

/**
 * Ký hiệu đi kèm màu giá, để không chỉ dựa vào màu (mù màu, in đen trắng, tương phản cao):
 * trần "T", sàn "S" (có tên đọc "Giá trần"/"Giá sàn"), tăng ▲, giảm ▼; tham chiếu không có ký hiệu.
 * Màu theo chữ bên cạnh (currentColor).
 */
export function PriceMark({ level, className }: { level: PriceLevel; className?: string }) {
  if (level === 'ref') return null
  if (level === 'ceiling' || level === 'floor') {
    const label = level === 'ceiling' ? 'Giá trần' : 'Giá sàn'
    return (
      <span
        role="img"
        aria-label={label}
        title={label}
        data-price-mark={level}
        className={cn('ml-1 inline-block rounded-sm border border-current px-0.5 align-[0.1em] text-[0.65rem] leading-none font-bold', className)}
      >
        {level === 'ceiling' ? 'T' : 'S'}
      </span>
    )
  }
  return (
    <span data-price-mark={level} className={cn('ml-0.5 text-[0.7em]', className)}>
      <span aria-hidden>{level === 'up' ? '▲' : '▼'}</span>
      <span className="sr-only">{level === 'up' ? 'tăng' : 'giảm'}</span>
    </span>
  )
}
