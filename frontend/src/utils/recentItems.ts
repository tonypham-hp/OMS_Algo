import type { SearchItem } from './search'

export const RECENT_LIMIT = 5
const RECENT_KEY = 'oms-palette-recent'

/** Phần cần nhớ của một mục đã mở. Không lưu từ khóa để bản lưu nhỏ. */
export type RecentItem = Pick<SearchItem, 'id' | 'group' | 'title' | 'subtitle' | 'target'>

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

const browserStorage = (): StorageLike | undefined => (typeof window === 'undefined' ? undefined : window.localStorage)

/** localStorage có thể bị chặn hoặc chứa dữ liệu hỏng: lỗi thì coi như chưa có mục nào. */
export function readRecent(storage: StorageLike | undefined = browserStorage()): RecentItem[] {
  try {
    const raw = storage?.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is RecentItem => typeof item?.id === 'string' && typeof item?.title === 'string').slice(0, RECENT_LIMIT)
  } catch {
    return []
  }
}

/** Đưa mục vừa mở lên đầu, bỏ bản trùng, giữ tối đa 5 mục. Trả về danh sách mới. */
export function pushRecent(item: SearchItem | RecentItem, storage: StorageLike | undefined = browserStorage()): RecentItem[] {
  const entry: RecentItem = { id: item.id, group: item.group, title: item.title, subtitle: item.subtitle, target: item.target }
  const next = [entry, ...readRecent(storage).filter((existing) => existing.id !== item.id)].slice(0, RECENT_LIMIT)
  try {
    storage?.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // Không lưu được thì lần sau không có mục gần đây, tìm kiếm vẫn chạy bình thường.
  }
  return next
}
