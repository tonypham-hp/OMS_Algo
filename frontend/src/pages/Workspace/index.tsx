import 'dockview-react/dist/styles/dockview.css'
import '@/styles/workspace.css'
import { DockviewReact, type DockviewApi, type DockviewReadyEvent, type DockviewTheme } from 'dockview-react'
import { Keyboard, X } from 'lucide-react'
import { useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useWorkspaceHotkeys } from '@/hotkeys/useWorkspaceHotkeys'
import { useUiStore } from '@/store/ui.store'
import { openTicket } from '@/workspace/commands'
import { LAYOUT } from '@/config/theme'
import { useAuthStore } from '@/store/auth.store'
import { useWorkspaceStore } from '@/store/workspace.store'
import type { PanelParams } from '@/workspace/panelTypes'
import { PANEL_COMPONENTS } from '@/workspace/panels'
import { nextLayoutName } from '@/workspace/layouts'
import { addWorkspacePanel, panelKind } from '@/workspace/presets'
import { useWorkspaceLayouts } from '@/workspace/useWorkspaceLayouts'
import { WorkspaceActionsContext, type WorkspaceActions } from '@/workspace/workspaceContext'
import { GroupActions } from './GroupActions'
import { LayoutMenu } from './LayoutMenu'
import { PanelTab } from './PanelTab'

/** Theme dockview riêng: biến --dv-* trỏ về token (src/styles/workspace.css), tự theo 4 theme và bảng màu mù màu. */
const OMS_DOCK_THEME: DockviewTheme = { name: 'oms', className: 'dockview-theme-oms', dndOverlayMounting: 'absolute' }

/**
 * Bàn làm việc (Đợt 10A): nhiều panel dock được, kéo tab để dock trái/phải/trên/dưới hoặc gộp tab,
 * kéo viền để đổi kích thước, thả nổi một panel. Panel dùng lại component của các màn có sẵn.
 */
export default function Workspace() {
  const role = useAuthStore((state) => state.user?.role)
  const username = useAuthStore((state) => state.user?.username)
  const apiRef = useRef<DockviewApi | null>(null)
  const layouts = useWorkspaceLayouts(apiRef, username, role)
  const { initialize } = layouts
  const setShortcutsOpen = useUiStore((state) => state.setShortcutsOpen)
  const [searchParams, setSearchParams] = useSearchParams()
  useWorkspaceHotkeys(apiRef)

  // Khôi phục bố cục đã lưu của tài khoản (hỏng thì dùng mẫu theo vai trò, kèm câu báo nhẹ).
  // Mở từ Ctrl+K "Mở phiếu Mua/Bán" (?phieu=mua|ban): mở phiếu ngay khi bàn làm việc sẵn sàng, rồi bỏ tham số.
  const requestedSide = searchParams.get('phieu')
  const onReady = useCallback(
    (event: DockviewReadyEvent) => {
      apiRef.current = event.api
      initialize(event.api)
      if (requestedSide === 'mua' || requestedSide === 'ban') {
        openTicket(event.api, requestedSide === 'mua' ? 'BUY' : 'SELL')
        setSearchParams((params) => {
          params.delete('phieu')
          return params
        }, { replace: true })
      }
    },
    // Chỉ chạy một lần lúc dockview sẵn sàng.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialize],
  )

  const actions = useMemo<WorkspaceActions>(
    () => ({
      openOrder: (group, orderId, fromPanelId) => {
        const api = apiRef.current
        if (!api) return
        if (group !== 'none') useWorkspaceStore.getState().setGroupOrder(group, orderId)
        const detail = api.panels.find(
          (panel) => panelKind(panel) === 'order-detail' && (panel.params as PanelParams | undefined)?.group === group,
        )
        if (detail) {
          if (group === 'none') detail.api.updateParameters({ ...(detail.params as PanelParams), orderId })
          detail.api.setActive()
          return
        }
        // Chưa có panel Chi tiết cùng nhóm: mở thêm bên phải panel vừa bấm.
        const added = addWorkspacePanel(api, 'order-detail', { referencePanel: fromPanelId, direction: 'right' }, { group })
        if (group === 'none') added.api.updateParameters({ group, orderId })
      },
    }),
    [],
  )

  return (
    <div
      className="flex flex-col gap-2"
      // Chiếm hết chiều cao còn lại dưới thanh trên (trừ khoảng đệm của <main>).
      style={{ height: `calc(100svh - ${LAYOUT.topBarHeight}px - 2rem)` }}
      data-testid="workspace"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold">Bàn làm việc</h1>
        <LayoutMenu
          menu={layouts.menu}
          suggestedName={nextLayoutName(layouts.menu.names)}
          onSwitch={layouts.switchTo}
          onSaveAs={layouts.saveAs}
          onRemove={layouts.remove}
          onTemplate={layouts.applyTemplate}
          onExport={layouts.exportJson}
          onImport={layouts.importJson}
          onMessage={layouts.setNotice}
          filename={`ban-lam-viec-${username ?? 'demo'}.json`}
        />
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => setShortcutsOpen(true)}
          title="Bảng phím tắt (? hoặc /)"
          aria-keyshortcuts="Shift+/ /"
        >
          <Keyboard aria-hidden /> Phím tắt
        </Button>
      </div>
      {layouts.notice && (
        <div role="status" className="bg-status-warning-bg text-status-warning flex items-center justify-between gap-2 rounded-md px-3 py-1.5 text-sm">
          <span>{layouts.notice}</span>
          <button type="button" aria-label="Đóng thông báo" onClick={() => layouts.setNotice(null)} className="rounded p-0.5">
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}
      <div className="border-border min-h-0 flex-1 overflow-hidden rounded-lg border">
        <WorkspaceActionsContext.Provider value={actions}>
          <DockviewReact
            theme={OMS_DOCK_THEME}
            components={PANEL_COMPONENTS}
            defaultTabComponent={PanelTab}
            rightHeaderActionsComponent={GroupActions}
            onReady={onReady}
            floatingGroupBounds="boundedWithinViewport"
          />
        </WorkspaceActionsContext.Provider>
      </div>
    </div>
  )
}
