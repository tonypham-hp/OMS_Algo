import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ChildOrder, OrderEvent, OrderEventAction } from '@/types'
import { EVENT_ACTION_LABELS, formatEventActor, formatEventChange } from './eventFormat'
import { SCROLL_TABLE, STICKY_HEADER } from './tableStyles'

const ALERT_ACTIONS: ReadonlySet<OrderEventAction> = new Set(['CHILD_UNKNOWN', 'REJECT'])

interface OrderEventLogProps {
  events: OrderEvent[]
  childOrders: ChildOrder[]
}

/** Nhật ký theo thời gian, mới nhất ở trên để thấy ngay khi engine đang chạy. */
export function OrderEventLog({ events, childOrders }: OrderEventLogProps) {
  const cycleOf = new Map(childOrders.map((child) => [child.child_order_id, child.cycle_no]))

  return (
    <div className={SCROLL_TABLE}>
      <Table>
        <TableHeader className={STICKY_HEADER}>
          <TableRow>
            <TableHead>Thời gian</TableHead>
            <TableHead>Người thực hiện</TableHead>
            <TableHead>Hành động</TableHead>
            <TableHead>Giá trị cũ → mới</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.toReversed().map((event) => {
            const cycle = event.child_order_id ? cycleOf.get(event.child_order_id) : undefined
            return (
              <TableRow key={event.event_id}>
                <TableCell className="tabular-nums">{formatDateTime(event.event_time)}</TableCell>
                <TableCell>{formatEventActor(event.user_id)}</TableCell>
                <TableCell className={cn(ALERT_ACTIONS.has(event.action) && 'font-medium text-red-300')}>
                  {EVENT_ACTION_LABELS[event.action]}
                  {cycle !== undefined && <span className="text-muted-foreground"> · chu kỳ {cycle}</span>}
                </TableCell>
                <TableCell className="whitespace-normal">{formatEventChange(event)}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
