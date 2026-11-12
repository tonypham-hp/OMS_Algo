import type { ReactNode } from 'react'
import { formatBps, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AttentionSummary, FilledToday, RunningStats } from '@/utils/dashboard'

interface KpiProps {
  label: string
  value: ReactNode
  note: ReactNode
  isAlert?: boolean
  /** data-demo-id để Chế độ Demo tô sáng thẻ này. */
  demoId: string
}

function Kpi({ label, value, note, isAlert = false, demoId }: KpiProps) {
  return (
    <div data-demo-id={demoId} className={cn('bg-card flex flex-col gap-1 rounded-lg border p-4', isAlert && 'border-red-400/70')}>
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className={cn('text-3xl font-semibold tabular-nums', isAlert && 'text-red-300')}>{value}</p>
      <p className="text-muted-foreground text-xs">{note}</p>
    </div>
  )
}

interface KpiCardsProps {
  running: RunningStats
  filled: FilledToday
  attention: AttentionSummary
  slippageBps: number | null
}

export function KpiCards({ running, filled, attention, slippageBps }: KpiCardsProps) {
  const { counts } = attention
  const filledPct = filled.ordered > 0 ? Math.round((filled.filled / filled.ordered) * 100) : 0
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi
        label="Lệnh đang chạy"
        demoId="kpi-running"
        value={formatNumber(running.running)}
        note={`${formatNumber(running.paused)} lệnh đang tạm dừng`}
      />
      <Kpi
        label="Khối lượng khớp hôm nay"
        demoId="kpi-filled"
        value={formatNumber(filled.filled)}
        note={`Trên tổng ${formatNumber(filled.ordered)} CP đã đặt (${filledPct}%)`}
      />
      <Kpi
        label="Cần chú ý"
        demoId="kpi-attention"
        value={formatNumber(attention.orders)}
        isAlert={attention.orders > 0}
        note={
          <span className="tabular-nums">
            UNKNOWN {counts.UNKNOWN} · REJECTED {counts.REJECTED} · PAUSED_SYSTEM {counts.PAUSED_SYSTEM}
          </span>
        }
      />
      <Kpi
        label="Slippage TB so với arrival"
        demoId="kpi-slippage"
        value={slippageBps === null ? '—' : formatBps(slippageBps)}
        note={
          slippageBps === null
            ? 'Chưa có lệnh khớp kèm giá arrival'
            : 'Gia quyền theo KL; dương là bất lợi (mua cao hơn, bán thấp hơn arrival)'
        }
      />
    </div>
  )
}
