import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import type { OrderEvent } from '@/types'
import {
  EMPTY_FEED,
  markAllRead,
  markRead,
  mergeNotifications,
  type NotificationFeed,
} from '@/utils/notifications'

/** localStorage có thể bị chặn hoặc không có (chế độ riêng tư, môi trường test): lỗi thì bỏ qua, không làm vỡ app. */
const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return globalThis.localStorage?.getItem(name) ?? null
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      globalThis.localStorage?.setItem(name, value)
    } catch {
      // Không lưu được: thông báo vẫn dùng được trong phiên hiện tại.
    }
  },
  removeItem: (name) => {
    try {
      globalThis.localStorage?.removeItem(name)
    } catch {
      // Bỏ qua.
    }
  },
}

interface NotificationState {
  /** Mỗi tài khoản một danh sách riêng: đổi tài khoản không thấy thông báo của người trước. */
  feeds: Record<string, NotificationFeed>
  sync: (username: string, events: OrderEvent[]) => void
  markRead: (username: string, id: string) => void
  markAllRead: (username: string) => void
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      feeds: {},
      sync: (username, events) =>
        set((state) => {
          const current = state.feeds[username] ?? EMPTY_FEED
          const next = mergeNotifications(current, events)
          return next === current ? state : { feeds: { ...state.feeds, [username]: next } }
        }),
      markRead: (username, id) =>
        set((state) => {
          const current = state.feeds[username] ?? EMPTY_FEED
          return { feeds: { ...state.feeds, [username]: { ...current, items: markRead(current.items, id) } } }
        }),
      markAllRead: (username) =>
        set((state) => {
          const current = state.feeds[username] ?? EMPTY_FEED
          return { feeds: { ...state.feeds, [username]: { ...current, items: markAllRead(current.items) } } }
        }),
    }),
    { name: 'oms-notifications', storage: createJSONStorage(() => safeStorage), partialize: (state) => ({ feeds: state.feeds }) },
  ),
)

/** Danh sách thông báo của một tài khoản (mảng rỗng cố định khi chưa có, để selector không tạo mảng mới mỗi lần). */
const NO_ITEMS: NotificationFeed['items'] = []
export function selectItems(username: string | undefined) {
  return (state: NotificationState) => (username ? (state.feeds[username]?.items ?? NO_ITEMS) : NO_ITEMS)
}
