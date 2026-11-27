// Đặt cửa sổ tách lên màn hình khác (Đợt 10B) bằng Window Management API (Chrome/Edge: window.getScreenDetails).
// Trình duyệt không hỗ trợ hoặc người dùng không cho quyền: mở bằng window.open bình thường, không báo lỗi.

/** Phần thông tin màn hình cần dùng (ScreenDetailed của Window Management API). */
export interface ScreenInfo {
  label?: string
  availLeft: number
  availTop: number
  availWidth: number
  availHeight: number
  isPrimary?: boolean
}

export interface ScreenBox {
  left: number
  top: number
  width: number
  height: number
}

/** Lựa chọn màn hình nhớ trong bố cục (params của panel). */
export interface SavedScreen extends ScreenBox {
  label: string
}

/** Kích thước mặc định của cửa sổ tách đặt lên màn hình khác. */
export const DEFAULT_POPOUT_SIZE = { width: 960, height: 720 }

interface ScreenDetailsLike {
  screens: ScreenInfo[]
  currentScreen: ScreenInfo
}

type WindowWithScreens = { getScreenDetails?: () => Promise<ScreenDetailsLike> }

export function supportsScreenDetails(win: unknown = typeof window === 'undefined' ? undefined : window): boolean {
  return typeof (win as WindowWithScreens | undefined)?.getScreenDetails === 'function'
}

/**
 * Hỏi quyền rồi lấy danh sách màn hình. Không hỗ trợ, bị từ chối quyền hay lỗi: null (nơi gọi mở cửa sổ bình thường).
 */
export async function requestScreens(win: unknown = window): Promise<ScreenDetailsLike | null> {
  if (!supportsScreenDetails(win)) return null
  try {
    const details = await (win as Required<WindowWithScreens>).getScreenDetails()
    return details.screens.length > 0 ? details : null
  } catch {
    return null
  }
}

/** Cửa sổ kích thước `size`, giữa vùng dùng được của màn hình, không vượt quá màn hình (chừa lề 40 px). */
export function placeOnScreen(screen: ScreenInfo, size: { width: number; height: number } = DEFAULT_POPOUT_SIZE): ScreenBox {
  const width = Math.max(320, Math.min(size.width, screen.availWidth - 80))
  const height = Math.max(240, Math.min(size.height, screen.availHeight - 80))
  return {
    width,
    height,
    left: Math.round(screen.availLeft + (screen.availWidth - width) / 2),
    top: Math.round(screen.availTop + (screen.availHeight - height) / 2),
  }
}

const sameScreen = (a: ScreenInfo, b: ScreenInfo) =>
  a.availLeft === b.availLeft && a.availTop === b.availTop && a.availWidth === b.availWidth && a.availHeight === b.availHeight

/** Màn hình nên chọn sẵn: màn KHÁC màn đang mở bàn làm việc; chỉ có một màn thì dùng màn đó. */
export function pickDefaultScreen(screens: ScreenInfo[], current: ScreenInfo): ScreenInfo {
  return screens.find((screen) => !sameScreen(screen, current)) ?? current
}

/** Tên hiển thị của màn hình: nhãn hệ điều hành đặt, không có thì "Màn hình n"; kèm độ phân giải, màn chính. */
export function screenLabel(screen: ScreenInfo, index: number): string {
  const name = screen.label?.trim() || `Màn hình ${index + 1}`
  return `${name} · ${screen.availWidth}×${screen.availHeight}${screen.isPrimary ? ' · màn chính' : ''}`
}
