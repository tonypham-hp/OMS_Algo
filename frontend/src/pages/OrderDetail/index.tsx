import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { OrderStatusBadge } from '@/components/OrderStatusBadge'
import { SessionLockNotice } from '@/components/SessionLockNotice'
import { ErrorState, LoadingState } from '@/components/states'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SIDE_LABELS, STRATEGIES } from '@/config/strategies'
import { getTemplate } from '@/config/strategyTemplates'
import { useOrder, useOrderDetail } from '@/hooks/useOrders'
import { cn } from '@/lib/utils'
import { ChildOrderTimeline } from './ChildOrderTimeline'
import { ExecutionTable } from './ExecutionTable'
import { OrderDetailActions } from './OrderDetailActions'
import { OrderEventLog } from './OrderEventLog'
import { OrderProgressChart } from './OrderProgressChart'
import { ExecQualityCard } from './ExecQualityCard'
import { HuntSweepPanel } from './HuntSweepPanel'
import { OrderBookCard } from './OrderBookCard'
import { OrderSummary } from './OrderSummary'
import { ExplainCard } from '@/explain/ExplainCard'
import { TermExampleContext } from '@/components/termContext'
import { useMarketStore } from '@/store/market.store'
import { getTermExample } from './termExample'

export default function OrderDetail() {
  const { id = '' } = useParams()
  const order = useOrder(id)
  const detail = useOrderDetail(id)
  const error = order.error ?? detail.error
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null)
  const quote = useMarketStore((state) => state.quotes.find((item) => item.symbol === order.data?.symbol))
  const termExample = useMemo(() => getTermExample(order.data, detail.data, quote?.ref_price ?? null), [order.data, detail.data, quote?.ref_price])

  /** Cuộn tới event trong nhật ký và tô sáng, đưa focus vào dòng đó để người dùng bàn phím đọc tiếp. */
  const showEvent = (eventId: string) => {
    setHighlightedEventId(eventId)
    requestAnimationFrame(() => {
      const row = document.querySelector<HTMLElement>(`[data-event-id="${CSS.escape(eventId)}"]`)
      row?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      row?.focus({ preventScroll: true })
    })
  }

  return (
    <TermExampleContext.Provider value={termExample}>
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>
              <h1>Chi tiết lệnh</h1>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {order.isPending && <LoadingState />}
            {error && (
              <ErrorState
                message={
                  <>
                    {error.message}.{' '}
                    <Link to="/so-lenh" className="underline">
                      Về sổ lệnh
                    </Link>
                  </>
                }
              />
            )}
            {order.data && (
              <>
                <ExplainCard order={order.data} detail={detail.data} onShowEvent={showEvent} />
                <SessionLockNotice />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-sm">{order.data.parent_order_id}</span>
                    <span className="font-semibold">{order.data.symbol}</span>
                    <span className={cn('font-medium', order.data.side === 'BUY' ? 'text-price-up' : 'text-price-down')}>
                      {SIDE_LABELS[order.data.side]}
                    </span>
                    <span>{STRATEGIES[order.data.strategy_type].label}</span>
                    {getTemplate(order.data.template_id) && (
                      <span className="text-muted-foreground text-sm" data-demo-id="order-template">
                        Mẫu: {getTemplate(order.data.template_id)?.name}
                      </span>
                    )}
                    <span data-demo-id="order-status" className="inline-flex">
                      <OrderStatusBadge status={order.data.status} />
                    </span>
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
            {order.data.strategy_type === 'HUNT' ? (
              <>
                <HuntSweepPanel order={order.data} detail={detail.data} />
                <ExecQualityCard order={order.data} detail={detail.data} />
              </>
            ) : (
              <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <ExecQualityCard order={order.data} detail={detail.data} />
                <OrderBookCard symbol={order.data.symbol} />
              </div>
            )}
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
                <ChildOrderTimeline items={detail.data.children} events={detail.data.events} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>
                  <h2>Nhật ký</h2>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <OrderEventLog events={detail.data.events} childOrders={detail.data.children} highlightedId={highlightedEventId} />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </TermExampleContext.Provider>
  )
}
