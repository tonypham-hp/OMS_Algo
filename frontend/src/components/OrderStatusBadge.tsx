import { Badge } from '@/components/ui/badge'
import { PARENT_STATUS_STYLES } from '@/config/orderStatus'
import type { ParentOrderStatus } from '@/types'

export function OrderStatusBadge({ status }: { status: ParentOrderStatus }) {
  const style = PARENT_STATUS_STYLES[status]
  return <Badge className={style.className}>{style.label}</Badge>
}
