import { Link, useParams } from 'react-router-dom'
import { OrderStatusBadge } from '@/components/OrderStatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SIDE_LABELS, STRATEGIES } from '@/config/strategies'
import { useOrder } from '@/hooks/useOrders'
import { PausedOrderBanner } from './PausedOrderBanner'

export default function OrderDetail() {
  const { id = '' } = useParams()
  const order = useOrder(id)

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Chi tiết lệnh</h1>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {order.isPending && <p className="text-muted-foreground text-sm">Đang tải...</p>}
        {order.error && (
          <p role="alert" className="text-destructive text-sm">
            {order.error.message}.{' '}
            <Link to="/so-lenh" className="underline">
              Về sổ lệnh
            </Link>
          </p>
        )}
        {order.data && (
          <>
            {order.data.status === 'PAUSED_SYSTEM' && <PausedOrderBanner order={order.data} />}
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-sm">{order.data.parent_order_id}</span>
              <span className="font-semibold">{order.data.symbol}</span>
              <span>{SIDE_LABELS[order.data.side]}</span>
              <span>{STRATEGIES[order.data.strategy_type].label}</span>
              <OrderStatusBadge status={order.data.status} />
            </div>
            <p className="text-muted-foreground text-sm">Các phần còn lại của màn này sẽ được làm ở đợt sau.</p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
