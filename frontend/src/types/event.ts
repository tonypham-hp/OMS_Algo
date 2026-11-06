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
}

export type NotificationType =
  | 'PARENT_ACTIVATED'
  | 'CONDITION_TRIGGERED'
  | 'CHILD_REJECTED'
  | 'PARENT_PAUSED'
  | 'PARENT_COMPLETED'
  | 'PARENT_CANCELLED'
  | 'PARENT_EXPIRED'

export interface Notification {
  notification_type: NotificationType
  /** Ngoài ERD: cho biết thông báo thuộc lệnh nào và lý do, để hiển thị được. */
  parent_order_id: string
  message: string
  sent_at: string
}
