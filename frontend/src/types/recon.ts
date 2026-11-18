// Đối soát OMS với Core và lịch sử nhiều phiên (Đợt 7). Ngoài ERD: backend phải có API tương ứng (docs/backend-gaps.md mục 13).
import type { ChildOrder, Execution, MarketSnapshot, ParentOrder } from './order'
import type { OrderEvent } from './event'

/** Trạng thái lệnh con mà Core ghi nhận. Core không có UNKNOWN: Core luôn biết mình có lệnh hay không. */
export type CoreOrderStatus = 'ACKNOWLEDGED' | 'PARTIAL_FILLED' | 'FILLED' | 'CANCELLED' | 'EXPIRED'

/** Một dòng "sổ phía Core": lệnh con mà Core đang giữ, kèm KL khớp Core ghi nhận. */
export interface CoreLedgerEntry {
  child_order_id: string
  parent_order_id: string
  /** null khi Core đã nhận lệnh nhưng OMS chưa có ACK (mất phản hồi). */
  core_order_id: string | null
  status: CoreOrderStatus
  filled_qty: number
  updated_at: string
}

export type ReconType =
  | 'STATUS_MISMATCH'
  | 'QTY_MISMATCH'
  | 'UNKNOWN_OPEN'
  | 'UNKNOWN_RESOLVED'
  | 'DUP_FILL_IGNORED'
  | 'PARENT_SUM_MISMATCH'
  | 'OVERFILL'

/** Mở; Chờ duyệt (đã có người đánh dấu, chờ người thứ hai duyệt); Đã xử lý. */
export type ReconRowStatus = 'OPEN' | 'PENDING_APPROVAL' | 'RESOLVED'

export interface ReconRow {
  /** Mã ổn định giữa các lần đối soát, để ghi quyết định xử lý. */
  id: string
  type: ReconType
  detected_at: string
  parent_order_id: string
  child_order_id: string | null
  oms_value: string
  core_value: string
  status: ReconRowStatus
  note: string | null
  /** Người đánh dấu đã xử lý (chờ duyệt hoặc đã duyệt). */
  requested_by: string | null
  /** Người duyệt. */
  approved_by: string | null
  /** OVERFILL: lỗi nghiêm trọng, phải luôn bằng 0. */
  critical: boolean
}

export interface ReconResult {
  from: string
  to: string
  checked_children: number
  matched_children: number
  rows: ReconRow[]
}

export interface ReconciliationData extends ReconResult {
  /** Thời điểm bấm "Đối soát ngay" gần nhất; null nếu chưa chạy. */
  last_run_at: string | null
  last_run_by: string | null
}

export interface ReconRangeRequest {
  from: string
  to: string
}

export interface ReconDecisionRequest {
  from: string
  to: string
  note: string
}

/** Dữ liệu màn Lịch sử: mọi lệnh người dùng được xem, kèm lệnh con, khớp, arrival và toàn bộ event. */
export interface HistoryData {
  trading_date: string
  orders: ParentOrder[]
  children: ChildOrder[]
  executions: Execution[]
  snapshots: Record<string, MarketSnapshot>
  events: OrderEvent[]
}
