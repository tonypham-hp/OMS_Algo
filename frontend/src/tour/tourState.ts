import type { Role } from '@/types'

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

const browserStorage = (): StorageLike | undefined => (typeof window === 'undefined' ? undefined : window.localStorage)

/** Tour chung (lần đầu đăng nhập) hoặc tour 1 bước của Bàn làm việc (lần đầu mở màn đó). */
export type TourKind = 'main' | 'workspace'

export const tourKey = (role: Role, kind: TourKind = 'main') => (kind === 'main' ? `oms-tour-${role}` : `oms-tour-workspace-${role}`)

/**
 * Đã xem (hoặc đã bỏ qua) tour của vai trò này chưa. Không đọc được localStorage (bị chặn) thì coi như đã xem,
 * để không hiện lại tour ở mọi lần đăng nhập; người dùng vẫn mở được từ menu tài khoản.
 */
export function hasSeenTour(role: Role, storage: StorageLike | undefined = browserStorage(), kind: TourKind = 'main'): boolean {
  try {
    if (!storage) return true
    return storage.getItem(tourKey(role, kind)) === 'done'
  } catch {
    return true
  }
}

/** Tour tự chạy một lần cho mỗi vai trò, và không bao giờ tự chạy khi đang ở Chế độ Demo. */
export function shouldStartTour(
  role: Role | undefined,
  demoActive: boolean,
  storage: StorageLike | undefined = browserStorage(),
  kind: TourKind = 'main',
): boolean {
  if (!role || demoActive) return false
  return !hasSeenTour(role, storage, kind)
}

/** Ghi đã xem; gọi cả khi xem hết và khi bấm Bỏ qua. */
export function markTourDone(role: Role, storage: StorageLike | undefined = browserStorage(), kind: TourKind = 'main'): void {
  try {
    storage?.setItem(tourKey(role, kind), 'done')
  } catch {
    // Không lưu được: lần sau có thể hiện lại, không ảnh hưởng chức năng khác.
  }
}
