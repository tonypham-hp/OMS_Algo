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
