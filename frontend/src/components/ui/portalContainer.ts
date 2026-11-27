import { createContext, useContext } from 'react'

/**
 * Nơi gắn portal của overlay (Dialog, DropdownMenu, Select) – Đợt 10B. Panel ở cửa sổ tách / phiếu mini vẫn chạy trong
 * cây React của cửa sổ chính, nên mặc định Radix gắn portal vào body cửa sổ CHÍNH. Panel cung cấp body của cửa sổ
 * chứa nó để hộp thoại, menu hiện đúng cửa sổ người dùng đang thao tác. Không có (undefined): body mặc định.
 */
export const PortalContainerContext = createContext<HTMLElement | undefined>(undefined)

export function usePortalContainer(): HTMLElement | undefined {
  return useContext(PortalContainerContext)
}
