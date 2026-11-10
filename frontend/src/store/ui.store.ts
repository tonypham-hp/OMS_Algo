import { create } from 'zustand'

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
}

export const useUiStore = create<UiState>()((set, get) => ({
  selectedSymbol: 'FPT',
  setSelectedSymbol: (selectedSymbol) => set({ selectedSymbol }),
  sidebarCollapsed: readCollapsed(),
  toggleSidebar: () => {
    const sidebarCollapsed = !get().sidebarCollapsed
    writeCollapsed(sidebarCollapsed)
    set({ sidebarCollapsed })
  },
}))
