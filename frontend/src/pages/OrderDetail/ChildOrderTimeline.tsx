import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CHILD_STATUS_STYLES } from '@/config/orderStatus'
import { SIDE_LABELS } from '@/config/strategies'
import { formatDateTime, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ChildOrder, ChildOrderStatus } from '@/types'
import { NUMBER_CELL, SCROLL_TABLE, STICKY_HEADER } from './tableStyles'

const ALERT_STATUSES: ReadonlySet<ChildOrderStatus> = new Set(['UNKNOWN', 'REJECTED'])

/** Mỗi lệnh con một dòng, lệnh mới nhất ở trên. UNKNOWN, REJECTED được tô nổi bật. */
export function ChildOrderTimeline({ items }: { items: ChildOrder[] }) {
  if (items.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-sm">Chưa sinh lệnh con nào.</p>
  }

  return (
    <div className={SCROLL_TABLE}>
      <Table>
        <TableHeader className={STICKY_HEADER}>
          <TableRow>
            <TableHead className="text-right">Chu kỳ</TableHead>
            <TableHead>Chiều</TableHead>
            <TableHead>Loại</TableHead>
            <TableHead className="text-right">Giá</TableHead>
            <TableHead className="text-right">KL</TableHead>
            <TableHead className="text-right">Đã khớp</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead className="text-right">Thời điểm gửi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.toReversed().map((child) => {
            const style = CHILD_STATUS_STYLES[child.status]
            return (
              <TableRow
                key={child.child_order_id}
                data-child-id={child.child_order_id}
                className={cn(
                  ALERT_STATUSES.has(child.status) &&
                    'border-l-2 border-l-red-500 bg-red-500/15 font-medium hover:bg-red-500/20',
                )}
              >
                <TableCell className={NUMBER_CELL}>{child.cycle_no}</TableCell>
                <TableCell>{SIDE_LABELS[child.side]}</TableCell>
                <TableCell>{child.order_type}</TableCell>
                <TableCell className={NUMBER_CELL}>{child.price === null ? '—' : formatNumber(child.price)}</TableCell>
                <TableCell className={NUMBER_CELL}>{formatNumber(child.quantity)}</TableCell>
                <TableCell className={NUMBER_CELL}>{formatNumber(child.filled_qty)}</TableCell>
                <TableCell>
                  <Badge className={style.className}>{style.label}</Badge>
                </TableCell>
                <TableCell className={NUMBER_CELL}>{child.sent_at ? formatDateTime(child.sent_at) : '—'}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
