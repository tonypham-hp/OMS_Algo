import { PARENT_STATUS_STYLES } from '@/config/orderStatus'
import type { NotificationType, OrderEvent, ParentOrderStatus } from '@/types'

/** Thông báo trên chuông, sinh từ một OrderEvent. `id` là khóa của event nên một event chỉ tạo đúng một thông báo. */
export interface AppNotification {
  id: string
  notification_type: NotificationType
  parent_order_id: string
  message: string
  /** event_time của event gốc. */
  time: string
  read: boolean
}

/** Giữ tối đa chừng này thông báo mới nhất cho mỗi người dùng. */
export const NOTIFICATION_LIMIT = 50

const CONDITION_LABELS: Record<string, string> = {
  STOP: 'Stop',
  TAKE_PROFIT: 'Take Profit',
  TRAILING_STOP: 'Trailing Stop',
  HUNT: 'Săn giá',
}

const FINAL_TYPES: Partial<Record<ParentOrderStatus, NotificationType>> = {
  COMPLETED: 'PARENT_COMPLETED',
  CANCELLED: 'PARENT_CANCELLED',
  EXPIRED: 'PARENT_EXPIRED',
}

/** Event đổi trạng thái lệnh cha: không gắn lệnh con và giá trị cũ là một trạng thái lệnh cha (không phải điều kiện). */
function isParentStatusChange(event: OrderEvent): boolean {
  return event.child_order_id === null && event.old_value !== null && event.old_value in PARENT_STATUS_STYLES
}

function classify(event: OrderEvent): { type: NotificationType; message: string } | null {
  const id = event.parent_order_id
  switch (event.action) {
    case 'CREATE':
      return event.new_value === 'ACTIVE' ? { type: 'PARENT_ACTIVATED', message: `Lệnh ${id} đã kích hoạt` } : null
    case 'TRIGGER': {
      const conditionType = event.old_value?.split(':')[1] ?? ''
      const label = CONDITION_LABELS[conditionType] ?? conditionType
      return { type: 'CONDITION_TRIGGERED', message: `Lệnh ${id}: điều kiện ${label} đã kích hoạt`.replace('  ', ' ') }
    }
    case 'REJECT':
      return event.child_order_id
        ? { type: 'CHILD_REJECTED', message: `Lệnh ${id}: lệnh con ${event.child_order_id} bị Core từ chối` }
        : null
    case 'PAUSE':
      return isParentStatusChange(event) && event.new_value === 'PAUSED_SYSTEM'
        ? { type: 'PARENT_PAUSED', message: `Lệnh ${id} bị hệ thống tạm dừng` }
        : null
    default: {
      if (!isParentStatusChange(event)) return null
      const type = FINAL_TYPES[event.new_value as ParentOrderStatus]
      if (!type) return null
      return { type, message: `Lệnh ${id}: ${PARENT_STATUS_STYLES[event.new_value as ParentOrderStatus].label.toLowerCase()}` }
    }
  }
}

/**
 * Khóa của một event. Ngoài event_id còn kèm thời điểm, lệnh và hành động vì "Về đầu ngày" đánh số event lại từ đầu:
 * event mới có thể trùng event_id với event cũ.
 */
export function eventKey(event: OrderEvent): string {
  return [event.event_id, event.event_time, event.parent_order_id, event.action].join('|')
}

/** OrderEvent → thông báo theo loại Notification trong spec; event không thuộc loại nào → null. */
export function toNotification(event: OrderEvent): AppNotification | null {
  const result = classify(event)
  if (!result) return null
  return {
    id: eventKey(event),
    notification_type: result.type,
    parent_order_id: event.parent_order_id,
    message: result.message,
    time: event.event_time,
    read: false,
  }
}

export interface NotificationFeed {
  /** Mới nhất trước, tối đa NOTIFICATION_LIMIT mục. */
  items: AppNotification[]
  /** Khóa các event đã xét (kể cả event không sinh thông báo), để mục bị cắt khỏi danh sách không quay lại. */
  seen: string[]
}

export const EMPTY_FEED: NotificationFeed = { items: [], seen: [] }

/** Số khóa event đã xét được nhớ; phải lớn hơn số event API trả về mỗi lần (200). */
const SEEN_LIMIT = 1000

/**
 * Gộp thông báo mới từ danh sách event (cũ → mới). Event đã xét bị bỏ qua, nên gọi lại nhiều lần với cùng dữ liệu
 * không tạo trùng và không làm mất trạng thái đã đọc. Trả lại đúng object cũ nếu không có event mới.
 */
export function mergeNotifications(feed: NotificationFeed, events: OrderEvent[], limit = NOTIFICATION_LIMIT): NotificationFeed {
  const seen = new Set(feed.seen)
  const newKeys: string[] = []
  const added: AppNotification[] = []
  for (const event of events) {
    const key = eventKey(event)
    if (seen.has(key)) continue
    seen.add(key)
    newKeys.push(key)
    const notification = toNotification(event)
    if (notification) added.push(notification)
  }
  if (newKeys.length === 0) return feed
  return {
    // Đảo lại để mục mới nhất đứng đầu.
    items: added.length > 0 ? [...added.reverse(), ...feed.items].slice(0, limit) : feed.items,
    seen: [...feed.seen, ...newKeys].slice(-SEEN_LIMIT),
  }
}

export function countUnread(items: AppNotification[]): number {
  return items.filter((item) => !item.read).length
}

export function markRead(items: AppNotification[], id: string): AppNotification[] {
  return items.map((item) => (item.id === id && !item.read ? { ...item, read: true } : item))
}

export function markAllRead(items: AppNotification[]): AppNotification[] {
  return items.map((item) => (item.read ? item : { ...item, read: true }))
}
