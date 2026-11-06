import { Link } from 'react-router-dom'
import { OrderStatusBadge } from '@/components/OrderStatusBadge'
import { ProgressBar } from '@/components/ProgressBar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SIDE_LABELS, STRATEGIES } from '@/config/strategies'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ParentOrder } from '@/types'
import { OrderActions } from './OrderActions'

const NUMBER_CELL = 'text-right tabular-nums'

interface OrderTableProps {
  orders: ParentOrder[]
  showAccount: boolean
  isBusy: boolean
  onEdit: (order: ParentOrder) => void
  onCancel: (order: ParentOrder) => void
  onPause: (order: ParentOrder) => void
  onResume: (order: ParentOrder) => void
}

export function OrderTable({ orders, showAccount, isBusy, onEdit, onCancel, onPause, onResume }: OrderTableProps) {
  const columnCount = showAccount ? 11 : 10

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Mã lệnh</TableHead>
          {showAccount && <TableHead>Tài khoản</TableHead>}
          <TableHead>Mã</TableHead>
          <TableHead>Chiều</TableHead>
          <TableHead>Loại lệnh</TableHead>
          <TableHead className="text-right">KL đặt</TableHead>
          <TableHead className="text-right">KL khớp</TableHead>
          <TableHead>Tiến độ</TableHead>
          <TableHead className="text-right">Giá giới hạn</TableHead>
          <TableHead>Trạng thái</TableHead>
          <TableHead className="text-right">Hành động</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.length === 0 && (
          <TableRow>
            <TableCell colSpan={columnCount} className="text-muted-foreground py-8 text-center">
              Không có lệnh nào phù hợp.
            </TableCell>
          </TableRow>
        )}
        {orders.map((order) => (
          <TableRow key={order.parent_order_id} data-order-id={order.parent_order_id}>
            <TableCell>
              <Link to={`/so-lenh/${order.parent_order_id}`} className="font-mono text-xs hover:underline">
                {order.parent_order_id}
              </Link>
            </TableCell>
            {showAccount && <TableCell className="tabular-nums">{order.account_no}</TableCell>}
            <TableCell className="font-semibold">{order.symbol}</TableCell>
            <TableCell className={cn('font-medium', order.side === 'BUY' ? 'text-price-up' : 'text-price-down')}>
              {SIDE_LABELS[order.side]}
            </TableCell>
            <TableCell>{STRATEGIES[order.strategy_type].label}</TableCell>
            <TableCell className={NUMBER_CELL}>{formatNumber(order.total_qty)}</TableCell>
            <TableCell className={NUMBER_CELL}>{formatNumber(order.executed_qty)}</TableCell>
            <TableCell>
              <ProgressBar
                value={order.executed_qty}
                max={order.total_qty}
                label={`Tiến độ khớp lệnh ${order.parent_order_id}`}
              />
            </TableCell>
            <TableCell className={NUMBER_CELL}>
              {order.limit_price === null ? '—' : formatNumber(order.limit_price)}
            </TableCell>
            <TableCell>
              <OrderStatusBadge status={order.status} />
            </TableCell>
            <TableCell>
              <OrderActions
                order={order}
                isBusy={isBusy}
                onEdit={onEdit}
                onCancel={onCancel}
                onPause={onPause}
                onResume={onResume}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
