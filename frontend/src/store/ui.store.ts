import { create } from 'zustand'

interface UiState {
  /** Mã đang chọn, dùng chung giữa bảng giá và ticket đặt lệnh. */
  selectedSymbol: string
  setSelectedSymbol: (symbol: string) => void
}

export const useUiStore = create<UiState>()((set) => ({
  selectedSymbol: 'FPT',
  setSelectedSymbol: (selectedSymbol) => set({ selectedSymbol }),
}))
