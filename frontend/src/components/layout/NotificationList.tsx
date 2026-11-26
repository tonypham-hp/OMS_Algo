import { BellOff, CheckCheck } from 'lucide-react'
import { EmptyState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { selectItems, useNotificationStore } from '@/store/notification.store'
import type { AppNotification } from '@/utils/notifications'
import { countUnread } from '@/utils/notifications'

/** Nội dung một thông báo (chấm chưa đọc, câu báo, giờ): dùng chung cho chuông và panel Thông báo. */
export function NotificationItemContent({ item }: { item: AppNotification }) {
  return (
    <>
      <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', item.read ? 'bg-transparent' : 'bg-primary')} aria-hidden />
      <span className="flex min-w-0 flex-col text-left">
        <span className={cn('text-sm whitespace-normal', !item.read && 'font-semibold')}>
          {item.message}
          {!item.read && <span className="sr-only"> (chưa đọc)</span>}
        </span>
        <span className="text-muted-foreground text-xs tabular-nums">{formatDateTime(item.time)}</span>
      </span>
    </>
  )
}

/**
 * Danh sách thông báo dạng panel (Bàn làm việc): bấm một mục thì đánh dấu đã đọc và mở lệnh qua `onOpen`
 * (panel Chi tiết lệnh cùng nhóm).
 */
export function NotificationList({ onOpen }: { onOpen: (orderId: string) => void }) {
  const username = useAuthStore((state) => state.user?.username)
  const items = useNotificationStore(selectItems(username))
  const markRead = useNotificationStore((state) => state.markRead)
  const markAllRead = useNotificationStore((state) => state.markAllRead)
  const unread = countUnread(items)
  if (!username) return null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs" role="status">
          {unread > 0 ? `${unread} chưa đọc` : 'Đã đọc hết'}
        </p>
        <Button size="xs" variant="ghost" disabled={unread === 0} onClick={() => markAllRead(username)}>
          <CheckCheck aria-hidden /> Đánh dấu tất cả đã đọc
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={BellOff} title="Chưa có thông báo nào." description="Lệnh bị từ chối, tạm dừng hay khớp xong sẽ báo ở đây." />
      ) : (
        <ul className="flex flex-col" aria-label="Danh sách thông báo">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                data-notification-id={item.id}
                className="hover:bg-surface-hover focus-visible:bg-surface-hover flex w-full items-start gap-2 rounded-md px-2 py-2"
                onClick={() => {
                  markRead(username, item.id)
                  onOpen(item.parent_order_id)
                }}
              >
                <NotificationItemContent item={item} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
