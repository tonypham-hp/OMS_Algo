import { createContext, useContext } from 'react'
import { useUiStore } from '@/store/ui.store'

/**
 * "Mã đang chọn" mà một component đọc/ghi (Đợt 10A).
 * - Ngoài Bàn làm việc: không có Provider → dùng store toàn cục `useUiStore` như trước (Đặt lệnh, Sổ lệnh không đổi).
 * - Trong Bàn làm việc: mỗi panel có Provider theo nhóm liên kết của nó (store bàn làm việc) hoặc mã riêng ("Không nhóm").
 */
export interface SymbolScope {
  symbol: string
  setSymbol: (symbol: string) => void
  /** Giá vừa bấm trên sổ lệnh 3 mức; `nonce` tăng mỗi lần bấm (kể cả bấm lại cùng giá). */
  pickedPrice: { price: number; nonce: number } | null
  pickPrice: (price: number) => void
  /**
   * Mở một lệnh. Có (trong Bàn làm việc) thì mở ở panel Chi tiết lệnh cùng nhóm thay vì chuyển trang;
   * không có thì component dùng liên kết /so-lenh/:id như cũ.
   */
  openOrder?: (orderId: string) => void
  /** Lệnh đang xem của nhóm (panel Chi tiết lệnh). */
  orderId?: string | null
}

export const SymbolScopeContext = createContext<SymbolScope | null>(null)

/** Mã đang chọn theo ngữ cảnh: panel của Bàn làm việc, hoặc store toàn cục ở các màn khác. */
export function useSymbolScope(): SymbolScope {
  const scoped = useContext(SymbolScopeContext)
  // Hook luôn được gọi (đúng luật hook); ngoài Bàn làm việc mới dùng tới giá trị này.
  const symbol = useUiStore((state) => state.selectedSymbol)
  const setSymbol = useUiStore((state) => state.setSelectedSymbol)
  const pickedPrice = useUiStore((state) => state.pickedPrice)
  const pickPrice = useUiStore((state) => state.pickPrice)
  return scoped ?? { symbol, setSymbol, pickedPrice, pickPrice }
}
