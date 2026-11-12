import type { ReactNode } from 'react'
import { ProgressBar } from '@/components/ProgressBar'
import { PERSISTENCE_LABELS } from '@/config/strategies'
import { formatBps, formatDate, formatDateTime, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { OrderDetailData, ParentOrder } from '@/types'
import { getFillSummary, getStrategyParamRows } from './orderMetrics'

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums">{children}</dd>
    </div>
  )
}

const formatPrice = (price: number | null) => (price === null ? '—' : `${formatNumber(price)} đ`)

interface OrderSummaryProps {
  order: ParentOrder
  detail: OrderDetailData
}

/** Khối lượng, giá bình quân so với arrival và tham số của lệnh cha. */
export function OrderSummary({ order, detail }: OrderSummaryProps) {
  const fill = getFillSummary(order, detail.children, detail.executions, detail.snapshot)

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 lg:grid-cols-6" data-demo-id="order-executed">
        <Stat label="KL đặt">{formatNumber(order.total_qty)}</Stat>
        <Stat label="KL khớp">{formatNumber(order.executed_qty)}</Stat>
        <Stat label="KL còn lại">{formatNumber(order.total_qty - order.executed_qty)}</Stat>
        <Stat label="Giá BQ khớp">{formatPrice(fill.avgPrice)}</Stat>
        <Stat label="Giá arrival">{formatPrice(fill.arrivalPrice)}</Stat>
        <Stat label="Chênh lệch so với arrival">
          {fill.differenceBps === null ? (
            '—'
          ) : (
            <>
              {formatBps(fill.differenceBps)}
              {fill.isFavorable !== null && (
                <span className={cn('ml-1 text-xs', fill.isFavorable ? 'text-price-up' : 'text-price-down')}>
                  {fill.isFavorable ? 'có lợi' : 'bất lợi'}
                </span>
              )}
            </>
          )}
        </Stat>
      </dl>

      <ProgressBar
        value={order.executed_qty}
        max={order.total_qty}
        label={`Tiến độ khớp lệnh ${order.parent_order_id}`}
      />

      <dl className="grid grid-cols-2 gap-4 border-t pt-4 text-sm sm:grid-cols-3 lg:grid-cols-6" data-demo-id="order-params">
        {getStrategyParamRows(order, detail.parameters).map((row) => (
          <Stat key={row.label} label={row.label}>
            {row.value}
          </Stat>
        ))}
        <Stat label="Tài khoản">{order.account_no}</Stat>
        <Stat label="Hiệu lực">
          {PERSISTENCE_LABELS[order.persistence_mode]}, đến {formatDate(order.valid_to)}
        </Stat>
        <Stat label="Thời điểm đặt">{formatDateTime(order.created_at)}</Stat>
      </dl>
    </div>
  )
}
