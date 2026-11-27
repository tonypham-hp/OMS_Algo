import type { DockviewApi } from 'dockview-react'
import { mirrorDocument } from './windowMirror'
import { POPOUT_URL, useWindowsStore } from './windows'

export interface PopoutBox {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Tách panel ra cửa sổ trình duyệt riêng (dockview popout, bản miễn phí). Panel là duy nhất trong nhóm thì tách cả
 * nhóm, không thì chỉ tách panel đó. CHỈ gọi trong xử lý thao tác của người dùng (bấm menu, bấm "Mở lại"): trình duyệt
 * chặn `window.open` không có thao tác, và mỗi cú bấm chỉ mở được một cửa sổ.
 * Trả true nếu đã mở; false nếu bị chặn (dockview đưa panel về lưới, trang hiện hướng dẫn cho phép popup).
 */
export function popoutPanel(api: DockviewApi, panelId: string, position?: PopoutBox): Promise<boolean> {
  const panel = api.getPanel(panelId)
  if (!panel) return Promise.resolve(false)
  const item = panel.group.panels.length === 1 ? panel.group : panel
  return api.addPopoutGroup(item, { popoutUrl: POPOUT_URL, ...(position ? { position } : {}) })
}

/**
 * Ghi cửa sổ tách vào sổ đăng ký khi mở (kèm phản chiếu theme, style từ cửa sổ chính), gỡ khi đóng.
 * Gọi một lần trong onReady của dockview.
 */
export function trackPopoutWindows(api: DockviewApi) {
  const { addWindow, removeWindow } = useWindowsStore.getState()
  const stops = new Map<Window, () => void>()
  const added = api.onDidAddPopoutGroup((event) => {
    addWindow({ id: event.group.id, kind: 'popout', window: event.window })
    stops.set(event.window, mirrorDocument(document, event.window.document))
  })
  const closing = api.onWillClosePopoutWindow((event) => {
    stops.get(event.window)?.()
    stops.delete(event.window)
    const entry = useWindowsStore.getState().windows.find((item) => item.window === event.window)
    if (entry) removeWindow(entry.id)
  })
  return () => {
    added.dispose()
    closing.dispose()
    for (const stop of stops.values()) stop()
    stops.clear()
  }
}
