import type { Notification } from '@/types'

/** Lý do tạm dừng gần nhất. Lệnh có thể bị tạm dừng nhiều lần, chỉ lần mới nhất còn đúng. */
export function getPauseReason(notifications: Notification[]): string | null {
  return notifications.filter((item) => item.notification_type === 'PARENT_PAUSED').at(-1)?.message ?? null
}
