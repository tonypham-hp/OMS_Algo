import type { DockviewApi, IDockviewPanel } from 'dockview-react'
import { useWorkspaceStore } from '@/store/workspace.store'
import { symbolForPanel } from './linkGroups'
import type { LinkGroup, PanelKind, PanelParams } from './panelTypes'
import { addWorkspacePanel, panelKind } from './presets'

// Lệnh cấp bàn làm việc dùng cho phím tắt, Ctrl+K và kịch bản Demo. Không lệnh nào gửi lệnh giao dịch.

const paramsOf = (panel: IDockviewPanel | undefined): PanelParams => (panel?.params as PanelParams | undefined) ?? { group: '1' }

/** Đưa focus bàn phím vào panel (sau khi dockview hiện panel đó). */
export function focusPanel(panel: IDockviewPanel, selector?: string) {
  panel.api.setActive()
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      // Panel có thể đang ở cửa sổ tách (Đợt 10B): tìm trong document chứa nhóm của nó.
      const owner = panel.group.element.ownerDocument
      const frame = owner.querySelector<HTMLElement>(`[data-ws-panel="${CSS.escape(panel.id)}"]`)
      const target = selector ? frame?.querySelector<HTMLElement>(selector) : null
      ;(target ?? frame)?.focus()
    }),
  )
}

/** Nhóm liên kết của panel đang hoạt động (chưa có panel nào: Nhóm 1). */
function activeLinkGroup(api: DockviewApi): LinkGroup {
  return paramsOf(api.activePanel ?? undefined).group ?? '1'
}

/** Panel cùng loại, ưu tiên cùng nhóm liên kết. */
function findPanel(api: DockviewApi, kind: PanelKind, group: LinkGroup): IDockviewPanel | undefined {
  const ofKind = api.panels.filter((panel) => panelKind(panel) === kind)
  return ofKind.find((panel) => paramsOf(panel).group === group) ?? ofKind[0]
}

/** Tới panel một loại (O, D, N): có thì chuyển tới, chưa có thì mở thêm cạnh panel đang hoạt động. */
export function showPanel(api: DockviewApi, kind: PanelKind): IDockviewPanel {
  const group = activeLinkGroup(api)
  const existing = findPanel(api, kind, group)
  const panel =
    existing ??
    addWorkspacePanel(api, kind, api.activePanel ? { referencePanel: api.activePanel, direction: 'right' } : undefined, {
      group: group === 'none' ? '1' : group,
    })
  focusPanel(panel)
  return panel
}

/**
 * B / S: mở Phiếu lệnh Mua / Bán với mã của panel đang chọn (hoặc nhóm của nó) và đưa focus vào ô Khối lượng.
 * Chỉ mở phiếu: người dùng vẫn phải bấm Đặt lệnh rồi Xác nhận.
 */
export function openTicket(api: DockviewApi, side: 'BUY' | 'SELL'): IDockviewPanel {
  const store = useWorkspaceStore.getState()
  const active = api.activePanel ?? undefined
  const activeParams = paramsOf(active)
  let group = activeParams.group ?? '1'
  if (group === 'none') {
    // Panel "Không nhóm": mang mã riêng của nó sang Nhóm 1 để phiếu dùng đúng mã đang xem.
    store.setGroupSymbol('1', symbolForPanel(activeParams, store.groups))
    group = '1'
  }
  const ticket =
    api.panels.find((panel) => panelKind(panel) === 'ticket' && paramsOf(panel).group === group) ??
    addWorkspacePanel(api, 'ticket', active ? { referencePanel: active, direction: 'right' } : undefined, { group })
  store.requestTicket(ticket.id, side)
  focusPanel(ticket, '#total_qty')
  return ticket
}

/** Panel theo thứ tự đọc: nhóm trên trước, cùng hàng thì trái trước; trong một nhóm theo thứ tự tab. */
export function panelsInReadingOrder(api: DockviewApi): IDockviewPanel[] {
  const position = (panel: IDockviewPanel) => {
    const box = panel.group.element.getBoundingClientRect()
    return { top: Math.round(box.top), left: Math.round(box.left), index: panel.group.panels.indexOf(panel) }
  }
  return [...api.panels].sort((a, b) => {
    const pa = position(a)
    const pb = position(b)
    return pa.top - pb.top || pa.left - pb.left || pa.index - pb.index
  })
}

/** Alt+1..9: chuyển tới panel thứ n. */
export function focusPanelAt(api: DockviewApi, index: number) {
  const panel = panelsInReadingOrder(api)[index]
  if (panel) focusPanel(panel)
}
