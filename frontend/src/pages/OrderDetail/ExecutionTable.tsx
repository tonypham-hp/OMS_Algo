import { EmptyState } from '@/components/states'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SIDE_LABELS } from '@/config/strategies'
import { formatDateTime, formatNumber } from '@/lib/format'
import type { ChildOrder, Execution } from '@/types'
import { NUMBER_CELL, SCROLL_TABLE, STICKY_HEADER } from './tableStyles'

interface ExecutionTableProps {
  items: Execution[]
  childOrders: ChildOrder[]
}

/** Các lần khớp, mới nhất ở trên. Cột Chiều để phân biệt lệnh thoát của Bracket. */
export function ExecutionTable({ items, childOrders }: ExecutionTableProps) {
  if (items.length === 0) {
    return <EmptyState title="Chưa có lần khớp nào." />
  }

  const sideOf = new Map(childOrders.map((child) => [child.child_order_id, child.side]))

  return (
    <div className={SCROLL_TABLE}>
      <Table>
        <TableHeader className={STICKY_HEADER}>
          <TableRow>
            <TableHead>Mã khớp</TableHead>
            <TableHead>Chiều</TableHead>
            <TableHead className="text-right">Giá</TableHead>
            <TableHead className="text-right">KL</TableHead>
            <TableHead className="text-right">Thời gian</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.toReversed().map((execution) => {
            const side = sideOf.get(execution.child_order_id)
            return (
              <TableRow key={execution.execution_id}>
                <TableCell className="font-mono text-xs">{execution.exchange_match_id}</TableCell>
                <TableCell>{side ? SIDE_LABELS[side] : '—'}</TableCell>
                <TableCell className={NUMBER_CELL}>{formatNumber(execution.price)}</TableCell>
                <TableCell className={NUMBER_CELL}>{formatNumber(execution.qty)}</TableCell>
                <TableCell className={NUMBER_CELL}>{formatDateTime(execution.match_time)}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
