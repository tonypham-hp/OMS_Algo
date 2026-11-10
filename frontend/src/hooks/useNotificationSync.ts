import { useEffect } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { useNotificationStore } from '@/store/notification.store'
import { useDashboard } from './useDashboard'

/** Đưa OrderEvent mới vào kho thông báo. Gọi một lần ở AppLayout; dùng chung query với Trung tâm lệnh. */
export function useNotificationSync() {
  const username = useAuthStore((state) => state.user?.username)
  const events = useDashboard().data?.events
  const sync = useNotificationStore((state) => state.sync)

  useEffect(() => {
    if (username && events) sync(username, events)
  }, [username, events, sync])
}
