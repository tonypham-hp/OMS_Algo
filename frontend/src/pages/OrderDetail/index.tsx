import { Link, useParams } from 'react-router-dom'
import { OrderStatusBadge } from '@/components/OrderStatusBadge'
import { SessionLockNotice } from '@/components/SessionLockNotice'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SIDE_LABELS, STRATEGIES } from '@/config/strategies'
import { useOrder, useOrderDetail } from '@/hooks/useOrders'
import { cn } from '@/lib/utils'
import { ChildOrderTimeline } from './ChildOrderTimeline'
import { ExecutionTable } from './ExecutionTable'
import { OrderDetailActions } from './OrderDetailActions'
import { OrderEventLog } from './OrderEventLog'
import { OrderProgressChart } from './OrderProgressChart'
import { OrderSummary } from './OrderSummary'
import { PausedOrderBanner } from './PausedOrderBanner'

export default function OrderDetail() {
  const { id = '' } = useParams()
  const order = useOrder(id)
  const detail = useOrderDetail(id)
  const error = order.error ?? detail.error

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>Chi tiết lệnh</h1>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {order.isPending && <p className="text-muted-foreground text-sm">Đang tải...</p>}
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error.message}.{' '}
              <Link to="/so-lenh" className="underline">
                Về sổ lệnh
              </Link>
            </p>
          )}
          {order.data && (
            <>
              {order.data.status === 'PAUSED_SYSTEM' && <PausedOrderBanner order={order.data} />}
              <SessionLockNotice />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-sm">{order.data.parent_order_id}</span>
                  <span className="font-semibold">{order.data.symbol}</span>
                  <span className={cn('font-medium', order.data.side === 'BUY' ? 'text-price-up' : 'text-price-down')}>
                    {SIDE_LABELS[order.data.side]}
                  </span>
                  <span>{STRATEGIES[order.data.strategy_type].label}</span>
                  <OrderStatusBadge status={order.data.status} />
                </div>
                <OrderDetailActions order={order.data} />
              </div>
              {detail.data && <OrderSummary order={order.data} detail={detail.data} />}
            </>
          )}
        </CardContent>
      </Card>

      {order.data && detail.data && (
        <>
          <div className="grid items-start gap-4 lg:grid-cols-[3fr_2fr]">
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>
                  <h2>KL khớp lũy kế</h2>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <OrderProgressChart order={order.data} detail={detail.data} />
              </CardContent>
            </Card>
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>
                  <h2>Khớp lệnh</h2>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ExecutionTable items={detail.data.executions} childOrders={detail.data.children} />
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Lệnh con</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChildOrderTimeline items={detail.data.children} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Nhật ký</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OrderEventLog events={detail.data.events} childOrders={detail.data.children} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
