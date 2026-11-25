import type { OpsAlertType, OrderReasonCode } from '@/types'

export const REASON_LABELS: Record<OrderReasonCode, string> = {
  PRICE_OUT_OF_BAND: 'Giá ngoài biên độ',
  CHILD_REJECTED_REPEAT: 'Core từ chối lặp lại',
  MARKET_DATA_STALE: 'Dữ liệu giá trễ',
  KILL_SWITCH: 'Kill switch',
  SYMBOL_HALTED: 'Mã tạm ngừng giao dịch',
}

const DANGER = 'bg-status-danger-bg text-status-danger'
const WARNING = 'bg-status-warning-bg text-status-warning'

export const OPS_ALERT_STYLES: Record<OpsAlertType, { label: string; className: string }> = {
  CHILD_UNKNOWN: { label: 'Lệnh con chưa rõ', className: DANGER },
  CHILD_REJECTED: { label: 'Lệnh con bị từ chối', className: DANGER },
  MARKET_DATA_STALE: { label: 'Giá trễ', className: WARNING },
  PARENT_PAUSED_SYSTEM: { label: 'Hệ thống tạm dừng', className: WARNING },
}
