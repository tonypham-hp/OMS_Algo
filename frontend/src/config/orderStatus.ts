import { rulesFor } from '@/rules/registry'
import { symbolBoard } from '@/rules/symbols'
import type { ChildOrderStatus, ParentOrder, ParentOrderStatus } from '@/types'

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

/**
 * Nhãn trạng thái của một lệnh cụ thể: lệnh trong ngày hết hiệu lực lúc hết khớp lệnh hiện "Hết hiệu lực 14:45"
 * (giờ lấy từ gói luật của bảng giao dịch của mã), còn lại theo bảng nhãn chung.
 */
export function getParentStatusLabel(order: Pick<ParentOrder, 'status' | 'expire_reason' | 'symbol' | 'updated_at'>): string {
  if (order.status === 'EXPIRED' && order.expire_reason === 'DAY_END') {
    const date = order.updated_at.slice(0, 10)
    return `Hết hiệu lực ${rulesFor(symbolBoard(order.symbol, date) ?? 'STO', date).expiryTime}`
  }
  return PARENT_STATUS_STYLES[order.status].label
}
