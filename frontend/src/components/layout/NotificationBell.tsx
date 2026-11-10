import { Bell, BellOff, CheckCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '@/components/states'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { selectItems, useNotificationStore } from '@/store/notification.store'
import { countUnread } from '@/utils/notifications'

/** Chuông: badge số chưa đọc, danh sách thông báo; bấm một mục thì đánh dấu đã đọc và mở lệnh. */
export function NotificationBell() {
  const navigate = useNavigate()
  const username = useAuthStore((state) => state.user?.username)
  const items = useNotificationStore(selectItems(username))
  const markRead = useNotificationStore((state) => state.markRead)
  const markAllRead = useNotificationStore((state) => state.markAllRead)
  const unread = countUnread(items)

  if (!username) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon-sm"
          variant="ghost"
          className="relative"
          aria-label={unread > 0 ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'}
        >
          <Bell aria-hidden />
          {unread > 0 && (
            <span className="bg-destructive absolute -top-1 -right-1 min-w-4 rounded-full px-1 text-[10px] leading-4 font-semibold text-white tabular-nums">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 max-w-[calc(100vw-2rem)]">
        <div className="flex items-center justify-between gap-2 px-2 py-1">
          <DropdownMenuLabel className="px-0">Thông báo</DropdownMenuLabel>
          <Button
            size="xs"
            variant="ghost"
            disabled={unread === 0}
            onClick={(event) => {
              // Giữ menu mở để thấy các mục chuyển sang đã đọc.
              event.preventDefault()
              markAllRead(username)
            }}
          >
            <CheckCheck aria-hidden /> Đánh dấu tất cả đã đọc
          </Button>
        </div>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <EmptyState icon={BellOff} title="Chưa có thông báo nào." />
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {items.map((item) => (
              <DropdownMenuItem
                key={item.id}
                className="flex items-start gap-2 py-2"
                onSelect={() => {
                  markRead(username, item.id)
                  navigate(`/so-lenh/${item.parent_order_id}`)
                }}
              >
                <span
                  className={cn('mt-1.5 size-2 shrink-0 rounded-full', item.read ? 'bg-transparent' : 'bg-primary')}
                  aria-hidden
                />
                <span className="flex min-w-0 flex-col">
                  <span className={cn('text-sm whitespace-normal', !item.read && 'font-semibold')}>
                    {item.message}
                    {!item.read && <span className="sr-only"> (chưa đọc)</span>}
                  </span>
                  <span className="text-muted-foreground text-xs tabular-nums">{item.time.replace('T', ' ')}</span>
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
