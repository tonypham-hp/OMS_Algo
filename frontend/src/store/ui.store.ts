import { create } from 'zustand'
import type { TourKind } from '@/tour/tourState'

/** Chỉ có trong trình duyệt; trong Node (test) trả undefined thay vì đụng tới localStorage thử nghiệm của Node. */
const browserStorage = (): Storage | undefined => (typeof window === 'undefined' ? undefined : window.localStorage)

const SIDEBAR_KEY = 'oms-sidebar-collapsed'

/** localStorage có thể bị chặn (chế độ riêng tư, chính sách trình duyệt): lỗi thì coi như chưa lưu. */
function readCollapsed(): boolean {
  try {
    return browserStorage()?.getItem(SIDEBAR_KEY) === '1'
  } catch {
    return false
  }
}

function writeCollapsed(collapsed: boolean) {
  try {
    browserStorage()?.setItem(SIDEBAR_KEY, collapsed ? '1' : '0')
  } catch {
    // Không lưu được thì lần sau mở lại ở trạng thái mặc định.
  }
}

interface UiState {
  /** Mã đang chọn, dùng chung giữa bảng giá và ticket đặt lệnh. */
  selectedSymbol: string
  setSelectedSymbol: (symbol: string) => void
  /** Thanh bên thu gọn chỉ còn icon. Nhớ qua các lần tải lại trang. */
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  /** Giá vừa bấm trên sổ lệnh, để ticket điền vào ô giá. `nonce` đổi mỗi lần bấm, kể cả bấm lại cùng giá. */
  pickedPrice: { price: number; nonce: number } | null
  pickPrice: (price: number) => void
  /** Hộp tìm nhanh (Ctrl+K) đang mở. */
  paletteOpen: boolean
  setPaletteOpen: (open: boolean) => void
  /** Tour hướng dẫn đang chạy (mở lại từ menu tài khoản). */
  tourOpen: boolean
  /** Tour nào đang mở: tour chung lần đầu đăng nhập, hoặc 1 bước giới thiệu Bàn làm việc (Đợt 10A). */
  tourKind: TourKind
  setTourOpen: (open: boolean, kind?: TourKind) => void
  /** Bảng phím tắt (? hoặc /) đang mở. */
  shortcutsOpen: boolean
  /** Cửa sổ mở bảng phím tắt (body của cửa sổ tách, Đợt 10B); undefined: cửa sổ chính. */
  shortcutsContainer: HTMLElement | undefined
  setShortcutsOpen: (open: boolean, container?: HTMLElement) => void
}

export const useUiStore = create<UiState>()((set, get) => ({
  selectedSymbol: 'FPT',
  setSelectedSymbol: (selectedSymbol) => set({ selectedSymbol }),
  pickedPrice: null,
  paletteOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  tourOpen: false,
  tourKind: 'main',
  setTourOpen: (tourOpen, tourKind = 'main') => set({ tourOpen, tourKind }),
  shortcutsOpen: false,
  shortcutsContainer: undefined,
  setShortcutsOpen: (shortcutsOpen, shortcutsContainer) => set({ shortcutsOpen, shortcutsContainer }),
  pickPrice: (price) => set({ pickedPrice: { price, nonce: (get().pickedPrice?.nonce ?? 0) + 1 } }),
  sidebarCollapsed: readCollapsed(),
  toggleSidebar: () => {
    const sidebarCollapsed = !get().sidebarCollapsed
    writeCollapsed(sidebarCollapsed)
    set({ sidebarCollapsed })
  },
}))
