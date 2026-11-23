import { SESSION_LABELS } from '@/config/hose'
import { defaultRules } from '@/rules/registry'
import { isAmendAllowed, isCancelAllowed } from '@/rules/session'
import type { RulePack } from '@/rules/types'
import { formatClock } from '@/lib/format'
import type { OrderReasonCode, ParentOrderStatus, SessionCode, SymbolPhase } from '@/types'

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

/** Lệnh đang chạy: engine còn sinh và khớp lệnh con. */
export function isRunningStatus(status: ParentOrderStatus): boolean {
  return PAUSABLE_STATUSES.has(status)
}

export function isTerminalStatus(status: ParentOrderStatus): boolean {
  return TERMINAL_STATUSES.has(status)
}

/** Lệnh hệ thống tạm dừng vì giá ngoài biên độ: chỉ được sửa giá, sửa hợp lệ thì tự chạy lại. */
export function isRepriceRequired(status: ParentOrderStatus, reasonCode: OrderReasonCode | null): boolean {
  return status === 'PAUSED_SYSTEM' && reasonCode === 'PRICE_OUT_OF_BAND'
}

/**
 * Lý do vận hành chưa được mở lại lệnh PAUSED_SYSTEM. null là được phép. UI và API giả lập dùng chung hàm này.
 * Giá ngoài biên độ phải sửa giá, vì mở lại nguyên giá cũ thì lệnh con sẽ sai biên độ.
 */
export function getReopenBlock(
  reasonCode: OrderReasonCode | null,
  isKillSwitched: boolean,
  isFeedStale: boolean,
): string | null {
  if (isKillSwitched) return 'Kill switch còn bật, chưa mở lại được'
  if (reasonCode === 'PRICE_OUT_OF_BAND') return 'Giá ngoài biên độ: phải sửa giá, không mở lại trực tiếp'
  if (isFeedStale) return 'Dữ liệu giá còn trễ, chưa mở lại được'
  return null
}

export interface OrderActionItem {
  action: OrderAction
  label: string
  availability: ActionAvailability
}

/** Lý do khóa sửa, hủy theo phiên; mã hạn chế nêu giờ khớp của lượt định kỳ. */
function lockReason(session: SessionCode, rules: RulePack, phase?: SymbolPhase): string {
  if (session === 'PERIODIC_LOCK' && phase?.call_end != null) {
    const minutes = Math.round((rules.restricted?.lockSecondsBeforeCall ?? 0) / 60)
    return `Khóa sửa, hủy ${minutes} phút cuối lượt khớp định kỳ (khớp lúc ${formatClock(phase.call_end).slice(0, 5)})`
  }
  return `Không được sửa, hủy lệnh trong ${SESSION_LABELS[session]}`
}

/** Danh sách nút hành động của một lệnh, dùng chung cho Sổ lệnh và Chi tiết lệnh. */
export function getOrderActionItems(
  status: ParentOrderStatus,
  session: SessionCode,
  reasonCode: OrderReasonCode | null = null,
  rules: RulePack = defaultRules(),
  phase?: SymbolPhase,
): OrderActionItem[] {
  const actions = getAllowedActions(status, session, reasonCode, rules, phase)
  const isPaused = status === 'PAUSED_USER' || status === 'PAUSED_SYSTEM'
  return [
    { action: 'edit', label: isRepriceRequired(status, reasonCode) ? 'Sửa giá' : 'Sửa', availability: actions.edit },
    { action: 'cancel', label: 'Hủy', availability: actions.cancel },
    isPaused
      ? { action: 'resume', label: 'Tiếp tục', availability: actions.resume }
      : { action: 'pause', label: 'Tạm dừng', availability: actions.pause },
  ]
}

/**
 * Bảng hành động ở mục 5 của spec. UI và API giả lập dùng chung hàm này.
 * Phiên khóa sửa, hủy lấy từ gói luật của mã (HOSE: ATO, ATC – chưa kiểm chứng với KRX).
 */
export function getAllowedActions(
  status: ParentOrderStatus,
  session: SessionCode,
  reasonCode: OrderReasonCode | null = null,
  rules: RulePack = defaultRules(),
  phase?: SymbolPhase,
): Record<OrderAction, ActionAvailability> {
  const sessionLock: ActionAvailability = {
    allowed: false,
    reason: lockReason(session, rules, phase),
  }
  const amendOpen = isAmendAllowed(rules, session)
  const cancelOpen = isCancelAllowed(rules, session)
  const wrongStatus: ActionAvailability = {
    allowed: false,
    reason: 'Trạng thái hiện tại của lệnh không cho phép thao tác này',
  }

  const canEdit = EDITABLE_STATUSES.has(status) || isRepriceRequired(status, reasonCode)
  const edit = canEdit ? (amendOpen ? { allowed: true } : sessionLock) : wrongStatus

  let cancel: ActionAvailability
  if (isTerminalStatus(status)) cancel = wrongStatus
  else if (status === 'CANCEL_PENDING') cancel = { allowed: false, reason: 'Lệnh đang được hủy' }
  else cancel = cancelOpen ? { allowed: true } : sessionLock

  return {
    edit,
    cancel,
    pause: PAUSABLE_STATUSES.has(status) ? { allowed: true } : wrongStatus,
    resume: status === 'PAUSED_USER' ? { allowed: true } : wrongStatus,
  }
}
