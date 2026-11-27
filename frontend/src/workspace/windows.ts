import { create } from 'zustand'

// Sổ đăng ký cửa sổ phụ của Bàn làm việc (Đợt 10B): cửa sổ tách panel (dockview popout) và cửa sổ phiếu mini nổi.
// Panel trong các cửa sổ này vẫn chạy trong cây React của cửa sổ chính (dockview vẽ bằng portal), nên store dùng chung
// theo tham chiếu; sổ này chỉ giữ tham chiếu cửa sổ để: phản chiếu theme/style, gắn phím tắt cho từng document,
// và đóng hết khi đăng xuất, bắt đầu Demo hoặc rời Bàn làm việc.

/** Đường dẫn trang trống của cửa sổ tách (public/popout.html, cùng origin). */
export const POPOUT_URL = '/popout.html'

export interface WorkspaceWindow {
  /** Id nhóm dockview trong cửa sổ tách, hoặc 'mini-ticket'. */
  id: string
  kind: 'popout' | 'mini-ticket'
  window: Window
}

interface WindowsState {
  windows: WorkspaceWindow[]
  addWindow: (entry: WorkspaceWindow) => void
  removeWindow: (id: string) => void
}

export const useWindowsStore = create<WindowsState>()((set) => ({
  windows: [],
  addWindow: (entry) => set((state) => ({ windows: [...state.windows.filter((item) => item.id !== entry.id), entry] })),
  removeWindow: (id) => set((state) => ({ windows: state.windows.filter((item) => item.id !== id) })),
}))

/**
 * Đóng mọi cửa sổ phụ. Cửa sổ tách đóng thì dockview tự đưa panel về vị trí cũ trong bàn làm việc;
 * cửa sổ phiếu mini đóng thì phiếu biến mất (bản nháp của phiếu mini không giữ).
 */
export function closeAllWindows(windows: ReadonlyArray<Pick<WorkspaceWindow, 'window'>> = useWindowsStore.getState().windows) {
  for (const entry of windows) {
    try {
      if (!entry.window.closed) entry.window.close()
    } catch {
      // Cửa sổ đã mất: bỏ qua.
    }
  }
}

/** Có được tách cửa sổ lúc này không (Demo đang chạy thì khóa: Demo điều khiển màn hình và dữ liệu riêng). */
export function popoutBlockedReason({ demoActive }: { demoActive: boolean }): string | null {
  return demoActive ? 'Đang chạy Demo: không tách cửa sổ' : null
}
