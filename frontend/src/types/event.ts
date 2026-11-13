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
