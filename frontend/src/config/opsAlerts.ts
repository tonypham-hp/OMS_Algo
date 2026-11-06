import type { OpsAlertType } from '@/types'

const DANGER = 'bg-red-500/20 text-red-300'
const WARNING = 'bg-amber-500/20 text-amber-300'

export const OPS_ALERT_STYLES: Record<OpsAlertType, { label: string; className: string }> = {
  CHILD_UNKNOWN: { label: 'Child chưa rõ', className: DANGER },
  CHILD_REJECTED: { label: 'Child bị từ chối', className: DANGER },
  MARKET_DATA_STALE: { label: 'Giá trễ', className: WARNING },
  PARENT_PAUSED_SYSTEM: { label: 'Hệ thống tạm dừng', className: WARNING },
}
