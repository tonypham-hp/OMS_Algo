import type { ParentOrderStatus } from './order'

export type OpsAlertType = 'CHILD_UNKNOWN' | 'CHILD_REJECTED' | 'MARKET_DATA_STALE' | 'PARENT_PAUSED_SYSTEM'

export interface OpsAlert {
  alert_id: string
  type: OpsAlertType
  /** null với cảnh báo toàn hệ thống (dữ liệu giá trễ): không có lệnh nào để mở. */
  parent_order_id: string | null
  /** Có ở cảnh báo của lệnh con, để đối soát được ngay từ cảnh báo. */
  child_order_id: string | null
  message: string
  time: string
}

/** TIMEOUT_BEFORE_CORE: Core chưa tạo lệnh (TC-E2E-140). TIMEOUT_AFTER_CORE: Core đã tạo lệnh (TC-E2E-141). */
export type PendingFaultType = 'REJECT' | 'TIMEOUT_BEFORE_CORE' | 'TIMEOUT_AFTER_CORE'

/** Lỗi đã bơm, chờ lệnh con tiếp theo của lệnh cha được gửi đi. */
export interface PendingFault {
  parent_order_id: string
  type: PendingFaultType
}

export interface ReopenOrderRequest {
  reason: string
}

export interface FaultTargetRequest {
  parent_order_id: string
}

export interface KillSwitchState {
  global: boolean
  accounts: string[]
}

export type KillSwitchRequest = { scope: 'ALL' } | { scope: 'ACCOUNT'; account_no: string }

export interface OpsOverview {
  status_counts: Record<ParentOrderStatus, number>
  child_unknown: number
  child_rejected: number
  quote_age_seconds: number
  is_feed_stale: boolean
  /** Nút bơm lỗi giá trễ đang bật. Tắt rồi thì phải chờ có giá mới mới hết trễ. */
  feed_fault_active: boolean
  alerts: OpsAlert[]
  pending_faults: PendingFault[]
  kill_switch: KillSwitchState
  accounts: string[]
}
