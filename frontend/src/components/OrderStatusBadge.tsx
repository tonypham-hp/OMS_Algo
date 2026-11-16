import { Tooltip } from '@/components/Tooltip'
import { Badge } from '@/components/ui/badge'
import { PARENT_STATUS_STYLES } from '@/config/orderStatus'
import type { ParentOrderStatus } from '@/types'

interface OrderStatusBadgeProps {
  status: ParentOrderStatus
  /** Câu giải thích rút gọn: có thì rê chuột hoặc Tab vào badge để xem. */
  explain?: string
}

export function OrderStatusBadge({ status, explain }: OrderStatusBadgeProps) {
  const style = PARENT_STATUS_STYLES[status]
  const badge = <Badge className={style.className}>{style.label}</Badge>
  if (!explain) return badge
  return (
    <Tooltip content={explain} className="rounded-md" label={`${style.label}. ${explain}`}>
      <span className="cursor-help underline decoration-dotted underline-offset-4" data-demo-id="status-explain">
        {badge}
      </span>
    </Tooltip>
  )
}
