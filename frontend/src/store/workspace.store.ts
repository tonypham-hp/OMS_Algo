import { create } from 'zustand'
import { LINK_GROUPS } from '@/workspace/panelTypes'

export type GroupId = (typeof LINK_GROUPS)[number]

export interface GroupState {
  symbol: string
  /** Lệnh đang xem ở panel Chi tiết lệnh của nhóm. */
  orderId: string | null
  /** Giá vừa bấm trên sổ lệnh 3 mức của nhóm (phiếu lệnh cùng nhóm điền vào ô giá). */
  pickedPrice: { price: number; nonce: number } | null
}

interface WorkspaceState {
  groups: Record<GroupId, GroupState>
  setGroupSymbol: (group: GroupId, symbol: string) => void
  setGroupOrder: (group: GroupId, orderId: string | null) => void
  pickGroupPrice: (group: GroupId, price: number) => void
  /**
   * Yêu cầu Phiếu lệnh (phím B/S): đặt chiều Mua/Bán. Chỉ mở phiếu, không bao giờ gửi lệnh.
   * `nonce` tăng mỗi lần để bấm B hai lần vẫn được xử lý.
   */
  ticketRequest: { panelId: string; side: 'BUY' | 'SELL'; nonce: number } | null
  requestTicket: (panelId: string, side: 'BUY' | 'SELL') => void
  /** Khôi phục trạng thái nhóm (mã, lệnh) theo bố cục đã lưu. */
  loadGroups: (groups: Partial<Record<GroupId, { symbol?: string; orderId?: string | null }>>) => void
}

const DEFAULT_SYMBOLS: Record<GroupId, string> = { '1': 'FPT', '2': 'HPG', '3': 'VCB', '4': 'SSI' }

export const initialGroups = (): Record<GroupId, GroupState> =>
  Object.fromEntries(LINK_GROUPS.map((group) => [group, { symbol: DEFAULT_SYMBOLS[group], orderId: null, pickedPrice: null }])) as Record<
    GroupId,
    GroupState
  >

/**
 * Trạng thái dùng chung của các nhóm liên kết trên Bàn làm việc. Panel đọc bằng selector hẹp theo nhóm của nó
 * (`s.groups[g].symbol`), nên đổi mã ở nhóm 1 không vẽ lại panel nhóm 2, và tick giá không đụng tới store này.
 */
export const useWorkspaceStore = create<WorkspaceState>()((set) => ({
  groups: initialGroups(),
  ticketRequest: null,
  requestTicket: (panelId, side) =>
    set((state) => ({ ticketRequest: { panelId, side, nonce: (state.ticketRequest?.nonce ?? 0) + 1 } })),
  setGroupSymbol: (group, symbol) =>
    set((state) =>
      state.groups[group].symbol === symbol ? state : { groups: { ...state.groups, [group]: { ...state.groups[group], symbol } } },
    ),
  setGroupOrder: (group, orderId) =>
    set((state) => ({ groups: { ...state.groups, [group]: { ...state.groups[group], orderId } } })),
  pickGroupPrice: (group, price) =>
    set((state) => {
      const previous = state.groups[group].pickedPrice
      return { groups: { ...state.groups, [group]: { ...state.groups[group], pickedPrice: { price, nonce: (previous?.nonce ?? 0) + 1 } } } }
    }),
  loadGroups: (groups) =>
    set(() => {
      const next = initialGroups()
      for (const group of LINK_GROUPS) {
        const saved = groups[group]
        if (saved?.symbol) next[group].symbol = saved.symbol
        if (saved?.orderId !== undefined) next[group].orderId = saved.orderId
      }
      return { groups: next }
    }),
}))
