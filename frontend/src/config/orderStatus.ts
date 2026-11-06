import type { ChildOrderStatus, ParentOrderStatus } from '@/types'

interface StatusStyle {
  label: string
  className: string
}

const NEUTRAL = 'bg-slate-500/20 text-slate-300'
const INFO = 'bg-sky-500/20 text-sky-300'
const PROGRESS = 'bg-indigo-500/20 text-indigo-300'
const SUCCESS = 'bg-green-500/20 text-green-300'
const WARNING = 'bg-amber-500/20 text-amber-300'
const DANGER = 'bg-red-500/20 text-red-300'

export const PARENT_STATUS_STYLES: Record<ParentOrderStatus, StatusStyle> = {
  DRAFT: { label: 'Nháp', className: NEUTRAL },
  ACTIVE: { label: 'Đang hoạt động', className: INFO },
  PARTIALLY_EXECUTED: { label: 'Khớp một phần', className: PROGRESS },
  PAUSED_USER: { label: 'Tạm dừng', className: WARNING },
  PAUSED_SYSTEM: { label: 'Hệ thống tạm dừng', className: WARNING },
  CANCEL_PENDING: { label: 'Đang hủy', className: WARNING },
  COMPLETED: { label: 'Hoàn tất', className: SUCCESS },
  CANCELLED: { label: 'Đã hủy', className: NEUTRAL },
  EXPIRED: { label: 'Hết hạn', className: NEUTRAL },
}

export const CHILD_STATUS_STYLES: Record<ChildOrderStatus, StatusStyle> = {
  CREATED: { label: 'Đã tạo', className: NEUTRAL },
  SENDING: { label: 'Đang gửi', className: INFO },
  ACKNOWLEDGED: { label: 'Đã xác nhận', className: INFO },
  PARTIAL_FILLED: { label: 'Khớp một phần', className: PROGRESS },
  FILLED: { label: 'Đã khớp', className: SUCCESS },
  CANCEL_PENDING: { label: 'Đang hủy', className: WARNING },
  CANCELLED: { label: 'Đã hủy', className: NEUTRAL },
  REJECTED: { label: 'Bị từ chối', className: DANGER },
  UNKNOWN: { label: 'Chưa rõ', className: DANGER },
  EXPIRED: { label: 'Hết hạn', className: NEUTRAL },
}
