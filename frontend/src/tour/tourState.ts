import type { Role } from '@/types'

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

const browserStorage = (): StorageLike | undefined => (typeof window === 'undefined' ? undefined : window.localStorage)

export const tourKey = (role: Role) => `oms-tour-${role}`

/**
 * Đã xem (hoặc đã bỏ qua) tour của vai trò này chưa. Không đọc được localStorage (bị chặn) thì coi như đã xem,
 * để không hiện lại tour ở mọi lần đăng nhập; người dùng vẫn mở được từ menu tài khoản.
 */
export function hasSeenTour(role: Role, storage: StorageLike | undefined = browserStorage()): boolean {
  try {
    if (!storage) return true
    return storage.getItem(tourKey(role)) === 'done'
  } catch {
    return true
  }
}

/** Tour tự chạy một lần cho mỗi vai trò, và không bao giờ tự chạy khi đang ở Chế độ Demo. */
export function shouldStartTour(role: Role | undefined, demoActive: boolean, storage: StorageLike | undefined = browserStorage()): boolean {
  if (!role || demoActive) return false
  return !hasSeenTour(role, storage)
}

/** Ghi đã xem; gọi cả khi xem hết và khi bấm Bỏ qua. */
export function markTourDone(role: Role, storage: StorageLike | undefined = browserStorage()): void {
  try {
    storage?.setItem(tourKey(role), 'done')
  } catch {
    // Không lưu được: lần sau có thể hiện lại, không ảnh hưởng chức năng khác.
  }
}
