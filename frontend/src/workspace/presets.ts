import type { AddPanelPositionOptions, DockviewApi, IDockviewPanel } from 'dockview-react'
import { PANEL_KINDS, nextPanelId, type LinkGroup, type PanelKind, type PanelParams } from './panelTypes'

export type PresetId = 'basic' | 'pro'

export const PRESET_LABELS: Record<PresetId, string> = {
  basic: 'Cơ bản',
  pro: 'Chuyên nghiệp',
}

/**
 * Thêm một panel vào bàn làm việc. Panel Phiếu lệnh luôn giữ nội dung khi bị ẩn sau tab khác (`renderer: 'always'`),
 * để bản nháp đang nhập không mất khi người dùng xem tab khác.
 */
export function addWorkspacePanel(
  api: DockviewApi,
  kind: PanelKind,
  position?: AddPanelPositionOptions,
  options: { group?: LinkGroup; id?: string; inactive?: boolean; initialWidth?: number; initialHeight?: number } = {},
) {
  const params: PanelParams = { group: options.group ?? '1' }
  return api.addPanel<PanelParams>({
    id: options.id ?? nextPanelId(kind, api.panels.map((panel) => panel.id)),
    component: kind,
    title: PANEL_KINDS[kind].title,
    params,
    renderer: kind === 'ticket' ? 'always' : 'onlyWhenVisible',
    inactive: options.inactive,
    initialWidth: options.initialWidth,
    initialHeight: options.initialHeight,
    ...(position ? { position } : {}),
  })
}

/**
 * Dựng bố cục mẫu trên bàn làm việc trống:
 * - Cơ bản: Danh mục | Phiếu lệnh, Sổ lệnh ở dưới.
 * - Chuyên nghiệp: Danh mục | Sổ lệnh 3 mức | Phiếu lệnh; dưới là Sổ lệnh (kèm tab Thuật toán đang chạy) | Chi tiết lệnh | Thông báo.
 * Mọi panel ở Nhóm 1 để chọn mã ở Danh mục là cả bàn đổi theo.
 */
export function applyPreset(api: DockviewApi, preset: PresetId) {
  api.clear()
  const watchlist = addWorkspacePanel(api, 'watchlist', undefined, { id: 'watchlist-1' })
  if (preset === 'basic') {
    const ticket = addWorkspacePanel(api, 'ticket', { referencePanel: watchlist, direction: 'right' }, { id: 'ticket-1' })
    const blotter = addWorkspacePanel(api, 'blotter', { direction: 'below' }, { id: 'blotter-1' })
    // Đặt kích thước sau khi dựng xong: kích thước ban đầu khi thêm bị chia lại mỗi lần thêm panel kế bên.
    ticket.group.api.setSize({ width: 420 })
    blotter.group.api.setSize({ height: 300 })
  } else {
    const depth = addWorkspacePanel(api, 'depth', { referencePanel: watchlist, direction: 'right' }, { id: 'depth-1' })
    const ticket = addWorkspacePanel(api, 'ticket', { referencePanel: depth, direction: 'right' }, { id: 'ticket-1' })
    const blotter = addWorkspacePanel(api, 'blotter', { direction: 'below' }, { id: 'blotter-1' })
    addWorkspacePanel(api, 'algos', { referencePanel: blotter, direction: 'within' }, { id: 'algos-1', inactive: true })
    const detail = addWorkspacePanel(api, 'order-detail', { referencePanel: blotter, direction: 'right' }, { id: 'order-detail-1' })
    const notifications = addWorkspacePanel(api, 'notifications', { referencePanel: detail, direction: 'right' }, { id: 'notifications-1' })
    ticket.group.api.setSize({ width: 400 })
    depth.group.api.setSize({ width: 300 })
    notifications.group.api.setSize({ width: 300 })
    detail.group.api.setSize({ width: 460 })
    blotter.group.api.setSize({ height: 320 })
  }
  watchlist.api.setActive()
}

/** Loại panel (tên component dockview) của một panel đang mở. */
export function panelKind(panel: IDockviewPanel): string {
  return panel.view.contentComponent
}
