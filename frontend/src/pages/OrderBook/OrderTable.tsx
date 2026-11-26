import { memo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { OrderStatusBadge } from '@/components/OrderStatusBadge'
import { ProgressBar } from '@/components/ProgressBar'
import { SensitiveAccount } from '@/components/Sensitive'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SIDE_LABELS, STRATEGIES } from '@/config/strategies'
import { explainOrderBrief } from '@/explain/explain'
import { useBriefMarket } from '@/explain/useExplainMarket'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { SymbolStatusBadge } from '@/components/SymbolStatusBadge'
import { useAuthStore } from '@/store/auth.store'
import { useMarketStore } from '@/store/market.store'
import type { ParentOrder, Role } from '@/types'
import { OrderActions } from './OrderActions'

const NUMBER_CELL = 'text-right tabular-nums'

interface OrderRowProps {
  order: ParentOrder
  showAccount: boolean
  isBusy: boolean
  role: Role
  onEdit: (order: ParentOrder) => void
  onCancel: (order: ParentOrder) => void
  onPause: (order: ParentOrder) => void
  onResume: (order: ParentOrder) => void
  /** Bàn làm việc: bấm mã lệnh mở ở panel Chi tiết lệnh cùng nhóm thay vì chuyển trang. */
  onOpenOrder?: (orderId: string) => void
  /** Lệnh đang mở ở panel Chi tiết cùng nhóm: đánh dấu dòng. */
  selected?: boolean
}

/**
 * Một dòng của Sổ lệnh. memo + chỉ theo dõi giá của đúng mã của dòng: nhịp giá của mã khác không vẽ lại dòng này,
 * còn lời giải thích trạng thái (phụ thuộc phiên và giá) vẫn cập nhật khi giá của mã đó đổi.
 */
const OrderRow = memo(function OrderRow({
  order,
  showAccount,
  isBusy,
  role,
  onEdit,
  onCancel,
  onPause,
  onResume,
  onOpenOrder,
  selected = false,
}: OrderRowProps) {
  const market = useBriefMarket(order.symbol)
  // Chỉ chọn trạng thái (chuỗi) để dòng không vẽ lại mỗi nhịp giá.
  const tradingStatus = useMarketStore((state) => state.quotes.find((quote) => quote.symbol === order.symbol)?.trading_status)
  const haltStatus = useMarketStore((state) => state.quotes.find((quote) => quote.symbol === order.symbol)?.halt?.status)
  return (
    <TableRow
      data-order-id={order.parent_order_id}
      data-demo-id={`order-row-${order.parent_order_id}`}
      data-state={selected ? 'selected' : undefined}
    >
      <TableCell>
        {onOpenOrder ? (
          <button
            type="button"
            onClick={() => onOpenOrder(order.parent_order_id)}
            aria-pressed={selected}
            className="font-mono text-xs hover:underline"
          >
            {order.parent_order_id}
          </button>
        ) : (
          <Link to={`/so-lenh/${order.parent_order_id}`} className="font-mono text-xs hover:underline">
            {order.parent_order_id}
          </Link>
        )}
      </TableCell>
      {showAccount && <TableCell className="tabular-nums"><SensitiveAccount value={order.account_no} /></TableCell>}
      <TableCell className="font-semibold">
        <span className="flex items-center gap-1.5">
          {order.symbol}
          <SymbolStatusBadge
            quote={{
              symbol: order.symbol,
              trading_status: tradingStatus,
              halt: haltStatus ? { status: haltStatus, since: 0, reopen_end: null } : undefined,
            }}
          />
        </span>
      </TableCell>
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
        <OrderStatusBadge status={order.status} order={order} explain={explainOrderBrief(order, market, role)} />
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
  )
})

interface OrderTableProps {
  orders: ParentOrder[]
  showAccount: boolean
  isBusy: boolean
  onEdit: (order: ParentOrder) => void
  onCancel: (order: ParentOrder) => void
  onPause: (order: ParentOrder) => void
  onResume: (order: ParentOrder) => void
  /** Nội dung khi không có dòng nào (chưa có lệnh, hoặc bộ lọc không ra kết quả). */
  empty: ReactNode
  onOpenOrder?: (orderId: string) => void
  selectedOrderId?: string | null
}

export function OrderTable({
  orders,
  showAccount,
  isBusy,
  onEdit,
  onCancel,
  onPause,
  onResume,
  empty,
  onOpenOrder,
  selectedOrderId = null,
}: OrderTableProps) {
  const columnCount = showAccount ? 11 : 10
  const role = useAuthStore((state) => state.user?.role ?? 'CUSTOMER')

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
            <TableCell colSpan={columnCount} className="whitespace-normal">
              {empty}
            </TableCell>
          </TableRow>
        )}
        {orders.map((order) => (
          <OrderRow
            key={order.parent_order_id}
            order={order}
            showAccount={showAccount}
            isBusy={isBusy}
            role={role}
            onEdit={onEdit}
            onCancel={onCancel}
            onPause={onPause}
            onResume={onResume}
            onOpenOrder={onOpenOrder}
            selected={order.parent_order_id === selectedOrderId}
          />
        ))}
      </TableBody>
    </Table>
  )
}
