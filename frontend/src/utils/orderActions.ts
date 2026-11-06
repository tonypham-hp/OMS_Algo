import { SESSION_LABELS } from '@/config/hose'
import type { OrderReasonCode, ParentOrderStatus, SessionCode } from '@/types'
import { isModifyCancelAllowed } from './hose'

export type OrderAction = 'edit' | 'cancel' | 'pause' | 'resume'

export interface ActionAvailability {
  allowed: boolean
  /** Lý do bị khóa, hiển thị khi rê chuột vào nút. */
  reason?: string
}

const TERMINAL_STATUSES: ReadonlySet<ParentOrderStatus> = new Set([
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
])

const EDITABLE_STATUSES: ReadonlySet<ParentOrderStatus> = new Set([
  'ACTIVE',
  'PARTIALLY_EXECUTED',
  'PAUSED_USER',
])

const PAUSABLE_STATUSES: ReadonlySet<ParentOrderStatus> = new Set(['ACTIVE', 'PARTIALLY_EXECUTED'])

export function isTerminalStatus(status: ParentOrderStatus): boolean {
  return TERMINAL_STATUSES.has(status)
}

/** Lệnh hệ thống tạm dừng vì giá ngoài biên độ: chỉ được sửa giá, sửa hợp lệ thì tự chạy lại. */
export function isRepriceRequired(status: ParentOrderStatus, reasonCode: OrderReasonCode | null): boolean {
  return status === 'PAUSED_SYSTEM' && reasonCode === 'PRICE_OUT_OF_BAND'
}

/** Bảng hành động ở mục 5 của spec. UI và API giả lập dùng chung hàm này. */
export function getAllowedActions(
  status: ParentOrderStatus,
  session: SessionCode,
  reasonCode: OrderReasonCode | null = null,
): Record<OrderAction, ActionAvailability> {
  const sessionLock: ActionAvailability = {
    allowed: false,
    reason: `Không được sửa, hủy lệnh trong ${SESSION_LABELS[session]}`,
  }
  const sessionOpen = isModifyCancelAllowed(session)
  const wrongStatus: ActionAvailability = {
    allowed: false,
    reason: 'Trạng thái hiện tại của lệnh không cho phép thao tác này',
  }

  const canEdit = EDITABLE_STATUSES.has(status) || isRepriceRequired(status, reasonCode)
  const edit = canEdit ? (sessionOpen ? { allowed: true } : sessionLock) : wrongStatus

  let cancel: ActionAvailability
  if (isTerminalStatus(status)) cancel = wrongStatus
  else if (status === 'CANCEL_PENDING') cancel = { allowed: false, reason: 'Lệnh đang được hủy' }
  else cancel = sessionOpen ? { allowed: true } : sessionLock

  return {
    edit,
    cancel,
    pause: PAUSABLE_STATUSES.has(status) ? { allowed: true } : wrongStatus,
    resume: status === 'PAUSED_USER' ? { allowed: true } : wrongStatus,
  }
}
