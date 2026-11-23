import type { PutThroughStatus } from '@/types'

const STYLES: Record<PutThroughStatus, { label: string; className: string }> = {
  PENDING_CONFIRM: { label: 'Chờ đối ứng xác nhận', className: 'bg-sky-500/20 text-sky-300' },
  MATCHED: { label: 'Đã khớp', className: 'bg-green-500/20 text-green-300' },
  REJECTED: { label: 'Đối ứng từ chối', className: 'bg-red-500/20 text-red-300' },
  CANCELLED: { label: 'Đã hủy', className: 'bg-slate-500/20 text-slate-300' },
  EXPIRED: { label: 'Hết hiệu lực', className: 'bg-slate-500/20 text-slate-300' },
}

export function putThroughStatusStyle(status: PutThroughStatus) {
  return STYLES[status]
}
