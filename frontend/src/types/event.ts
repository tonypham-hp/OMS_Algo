import type { AmendKind } from '@/rules/types'
export type OrderEventAction =
  | 'CREATE'
  | 'MODIFY'
  | 'PAUSE'
  | 'RESUME'
  | 'CANCEL'
  | 'TRIGGER'
  | 'CHILD_CREATE'
  | 'CHILD_SEND'
  | 'FILL'
  | 'REJECT'
  | 'RECOVERY'
  | 'DECISION'
  | 'CHILD_UNKNOWN'

/**
 * Mã lý do chuẩn của một lần đổi trạng thái (ngoài ERD). Backend thật phải trả đúng bộ mã này (docs/backend-gaps.md mục 12).
 * - Tạm dừng hệ thống: PRICE_OUT_OF_BAND, CHILD_REJECTED_REPEAT, MARKET_DATA_STALE, KILL_SWITCH.
 * - Người dùng: USER_PAUSE, USER_RESUME, USER_CANCEL, USER_REPRICE; vận hành mở lại: OPS_REOPEN;
 *   tự chạy lại khi có giá mới: MARKET_DATA_RESUMED.
 * - Hết hạn: DAY_END (lệnh DAY hết ngày), VALID_TO_REACHED (GTD, MULTI_SESSION tới valid_to), WINDOW_END (hết khung TWAP, VWAP),
 *   HUNT_MAX_WAIT (hết thời gian chờ săn), HUNT_NO_LEVEL (hết mức trong giới hạn giá, phần còn lại bị hủy).
 * - Lệnh con: CORE_REJECT (kèm reject_code), ACK_TIMEOUT, RECONCILED_KEPT, RECONCILED_CANCELLED.
 * - Quyết định của chiến lược: POV_THROTTLED (đã chạm % tham gia tối đa), HUNT_WAITING_LEVEL (chưa có mức trong giới hạn).
 * - Kết thúc: COMPLETED (khớp đủ).
 */
export type EventReasonCode =
  | 'PRICE_OUT_OF_BAND'
  | 'CHILD_REJECTED_REPEAT'
  | 'MARKET_DATA_STALE'
  | 'MARKET_DATA_RESUMED'
  | 'KILL_SWITCH'
  | 'USER_PAUSE'
  | 'USER_RESUME'
  | 'USER_CANCEL'
  | 'USER_REPRICE'
  | 'OPS_REOPEN'
  | 'DAY_END'
  | 'VALID_TO_REACHED'
  | 'WINDOW_END'
  | 'HUNT_MAX_WAIT'
  | 'HUNT_NO_LEVEL'
  | 'CORE_REJECT'
  | 'ACK_TIMEOUT'
  | 'RECONCILED_KEPT'
  | 'RECONCILED_CANCELLED'
  | 'POV_THROTTLED'
  | 'HUNT_WAITING_LEVEL'
  | 'COMPLETED'
  /** Đợt 8A: phần chưa khớp của lệnh con MTL chuyển thành LO tại giá khớp gần nhất ± 1 bước giá. */
  | 'MTL_REMAINDER_TO_LO'

/** Lý do Core từ chối lệnh con (ngoài ERD). */
export type CoreRejectCode = 'LOT_SIZE' | 'TICK_SIZE' | 'MAX_QTY' | 'PRICE_BAND' | 'OTHER'

/** Chi tiết của một lần khớp. `qty` là KL thực ghi nhận, có thể nhỏ hơn KL trong báo khớp nếu bị cắt bớt. */
export interface FillDetail {
  qty: number
  price: number
  exchange_match_id: string
}

/**
 * Một mức trong kế hoạch quét của HUNT.
 * TAKE: lấy `take` ở mức này; UNUSED: trong giới hạn giá nhưng đã đủ KL nên không cần;
 * OUT_OF_LIMIT: vượt giá tối đa (MUA) hoặc thấp hơn giá tối thiểu (BÁN) nên không được quét.
 */
export interface HuntSweepStep {
  price: number
  /** KL đang có ở mức lúc quét. */
  available: number
  take: number
  /** KL còn thiếu sau khi lấy ở mức này. */
  short_after: number
  status: 'TAKE' | 'UNUSED' | 'OUT_OF_LIMIT'
  /** Lệnh con sinh cho mức này (chỉ có ở TAKE khi engine đã đặt). */
  child_order_id?: string
}

/** Kế hoạch quét sổ lệnh của HUNT, chụp lại đúng lúc quét để xem lại. */
export interface HuntSweepPlan {
  side: 'BUY' | 'SELL'
  /** KL cần lấy lúc quét. */
  qty: number
  /** Giá tối đa (MUA) hoặc tối thiểu (BÁN); null là không giới hạn. */
  limit_price: number | null
  steps: HuntSweepStep[]
  /** Tổng KL dự kiến lấy được. */
  take_qty: number
  /** Giá bình quân dự kiến của phần lấy được; null nếu không lấy được gì. */
  avg_price: number | null
  /** KL còn thiếu sau khi quét. */
  remainder: number
  /** Cách xử lý phần còn lại: chờ (LO bị động) hoặc hủy. */
  remainder_policy: 'WAIT' | 'CANCEL'
  /** Sổ lệnh hai phía lúc quét, để vẽ lại khi "Xem lại". */
  book?: { bids: Array<{ price: number; qty: number }>; asks: Array<{ price: number; qty: number }> }
}

export interface OrderEvent {
  event_id: string
  parent_order_id: string
  child_order_id: string | null
  action: OrderEventAction
  user_id: string
  channel: string
  old_value: string | null
  new_value: string | null
  event_time: string
  /** Ngoài ERD: chỉ có ở event FILL. old_value, new_value vẫn là trạng thái lệnh con trước và sau khi khớp. */
  fill_detail?: FillDetail
  /** Ngoài ERD: lý do vận hành nhập khi mở lại lệnh PAUSED_SYSTEM. */
  reason?: string
  /** Ngoài ERD: kế hoạch quét sổ lệnh, chỉ có ở event DECISION HUNT_SWEEP. */
  sweep_plan?: HuntSweepPlan
  /** Ngoài ERD: mẫu chiến lược đã dùng khi đặt lệnh, chỉ có ở event CREATE. */
  template_id?: string
  /** Ngoài ERD: mã lý do chuẩn của lần đổi trạng thái này. */
  reason_code?: EventReasonCode
  /** Ngoài ERD: lý do Core từ chối, chỉ có khi reason_code = CORE_REJECT. */
  reject_code?: CoreRejectCode
  /** Ngoài ERD (Đợt 8A): loại sửa của event MODIFY: chỉ giá, tăng KL, giảm KL. */
  amend_kind?: AmendKind
}

export type NotificationType =
  | 'PARENT_ACTIVATED'
  | 'CONDITION_TRIGGERED'
  | 'CHILD_REJECTED'
  | 'PARENT_PAUSED'
  | 'PARENT_COMPLETED'
  | 'PARENT_CANCELLED'
  | 'PARENT_EXPIRED'
  // Ngoài ERD: cần cho các kịch bản lỗi ở Màn 4.
  | 'PARENT_RESUMED'
  | 'CHILD_UNKNOWN'
  | 'CHILD_RECOVERED'
  | 'DUPLICATE_FILL_IGNORED'

export interface Notification {
  notification_type: NotificationType
  /** Ngoài ERD: cho biết thông báo thuộc lệnh nào và lý do, để hiển thị được. */
  parent_order_id: string
  message: string
  sent_at: string
}
