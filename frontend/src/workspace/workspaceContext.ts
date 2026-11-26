import { createContext, useContext } from 'react'
import type { LinkGroup } from './panelTypes'

/** Thao tác cấp bàn làm việc mà panel cần (cần tới dockview api, nên do trang Bàn làm việc cung cấp). */
export interface WorkspaceActions {
  /** Mở lệnh ở panel Chi tiết lệnh cùng nhóm; chưa có panel đó thì mở thêm một panel. */
  openOrder: (group: LinkGroup, orderId: string, fromPanelId: string) => void
}

export const WorkspaceActionsContext = createContext<WorkspaceActions | null>(null)

export function useWorkspaceActions(): WorkspaceActions | null {
  return useContext(WorkspaceActionsContext)
}
