import type { PutThroughStatus } from '@/types'

const STYLES: Record<PutThroughStatus, { label: string; className: string }> = {
  PENDING_CONFIRM: { label: 'Chờ đối ứng xác nhận', className: 'bg-status-info-bg text-status-info' },
  MATCHED: { label: 'Đã khớp', className: 'bg-status-success-bg text-status-success' },
  REJECTED: { label: 'Đối ứng từ chối', className: 'bg-status-danger-bg text-status-danger' },
  CANCELLED: { label: 'Đã hủy', className: 'bg-status-neutral-bg text-status-neutral' },
  EXPIRED: { label: 'Hết hiệu lực', className: 'bg-status-neutral-bg text-status-neutral' },
}

export function putThroughStatusStyle(status: PutThroughStatus) {
  return STYLES[status]
}
