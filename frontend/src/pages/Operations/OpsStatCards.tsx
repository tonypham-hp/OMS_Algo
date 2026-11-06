import type { ReactNode } from 'react'
import { OrderStatusBadge } from '@/components/OrderStatusBadge'
import { PARENT_STATUS_STYLES } from '@/config/orderStatus'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { OpsOverview, ParentOrderStatus } from '@/types'

const STATUSES = Object.keys(PARENT_STATUS_STYLES) as ParentOrderStatus[]

function Stat({ label, value, note, isAlert }: { label: string; value: ReactNode; note?: string; isAlert: boolean }) {
  return (
    <div className={cn('rounded-md border p-3', isAlert && 'border-red-500/60 bg-red-500/10')}>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {note && <p className={cn('mt-0.5 text-xs', isAlert ? 'text-red-300' : 'text-muted-foreground')}>{note}</p>}
    </div>
  )
}

export function OpsStatCards({ overview }: { overview: OpsOverview }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Child UNKNOWN" value={formatNumber(overview.child_unknown)} isAlert={overview.child_unknown > 0} />
        <Stat label="Child REJECTED" value={formatNumber(overview.child_rejected)} isAlert={overview.child_rejected > 0} />
        <Stat
          label="Độ trễ dữ liệu giá"
          value={`${formatNumber(overview.quote_age_seconds)} giây`}
          note={overview.is_feed_stale ? 'Đang trễ, lệnh đang chạy bị tạm dừng' : 'Bình thường'}
          isAlert={overview.is_feed_stale}
        />
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-9">
        {STATUSES.map((status) => (
          <div key={status} className="flex flex-col items-start gap-1 rounded-md border p-2">
            <dt>
              <OrderStatusBadge status={status} />
            </dt>
            <dd className="text-lg font-semibold tabular-nums">{formatNumber(overview.status_counts[status])}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
