import 'dockview-react/dist/styles/dockview.css'
import '@/styles/workspace.css'
import { DockviewReact, type DockviewApi, type DockviewReadyEvent, type DockviewTheme } from 'dockview-react'
import { ExternalLink, Keyboard, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useWorkspaceHotkeys } from '@/hotkeys/useWorkspaceHotkeys'
import { WindowHotkeys } from '@/hotkeys/WindowHotkeys'
import { useDemoStore } from '@/store/demo.store'
import { useUiStore } from '@/store/ui.store'
import { shouldStartTour } from '@/tour/tourState'
import { focusPanel, openTicket } from '@/workspace/commands'
import { setWorkspaceDemoBridge } from '@/workspace/demoBridge'
import { LAYOUT } from '@/config/theme'
import { useAuthStore } from '@/store/auth.store'
import { useWorkspaceStore } from '@/store/workspace.store'
import type { PanelParams } from '@/workspace/panelTypes'
import { PANEL_COMPONENTS } from '@/workspace/panels'
import { nextLayoutName } from '@/workspace/layouts'
import { addWorkspacePanel, applyPreset, panelKind } from '@/workspace/presets'
import { useWorkspaceLayouts } from '@/workspace/useWorkspaceLayouts'
import { popoutPanel, trackPopoutWindows } from '@/workspace/popout'
import { closeAllWindows, popoutBlockedReason, useWindowsStore } from '@/workspace/windows'
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
      // Tách panel ra cửa sổ riêng (Đợt 10B): chỉ từ thao tác bấm menu; khóa khi đang Demo.
      popout: (panelId) => {
        const api = apiRef.current
        if (!api || popoutBlockedReason({ demoActive: useDemoStore.getState().snapshot !== null })) return
        void popoutPanel(api, panelId)
      },
    }),
    [],
  )

  // Rời Bàn làm việc: đóng mọi cửa sổ tách (dockview cũng đóng khi huỷ, đóng thêm cho chắc), xoá sổ đăng ký.
  useEffect(
    () => () => {
      closeAllWindows(useWindowsStore.getState().windows.filter((item) => item.kind === 'popout'))
    },
    [],
  )

  /** Mở lại MỘT cửa sổ tách đã được đưa về khi tải lại trang (mỗi cú bấm chỉ mở được một cửa sổ). */
  const reopenNext = () => {
    const api = apiRef.current
    const [next, ...rest] = layouts.returned
    if (!api || !next) return
    void popoutPanel(api, next.panelId, next.position ?? undefined)
    layouts.setReturned(rest)
  }

  // Lần đầu mở Bàn làm việc (mỗi vai trò): 1 bước tour giới thiệu. Không chạy khi đang Demo hay đang xem tour chung.
  const demoActive = useDemoStore((state) => state.snapshot !== null)
  useEffect(() => {
    if (useUiStore.getState().tourOpen) return
    if (shouldStartTour(role, demoActive, undefined, 'workspace')) useUiStore.getState().setTourOpen(true, 'workspace')
    // Chỉ xét lúc mở màn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cầu nối cho Chế độ Demo (kịch bản 13): đăng ký khi dockview sẵn sàng, gỡ khi rời trang.
  useEffect(() => () => setWorkspaceDemoBridge(null), [])
  const registerDemoBridge = useCallback(
    (api: DockviewApi) => {
      const groupTicket = () => api.panels.find((panel) => panelKind(panel) === 'ticket' && (panel.params as PanelParams | undefined)?.group === '1')
      setWorkspaceDemoBridge({
        preset: (preset) => applyPreset(api, preset),
        openTicket: (side) => openTicket(api, side),
        fillTicket: (values) => {
          const ticket = groupTicket()
          if (!ticket) return
          useWorkspaceStore.getState().requestFill(ticket.id, values)
          focusPanel(ticket)
        },
        resetTicket: () => {
          const ticket = groupTicket()
          if (ticket) useWorkspaceStore.getState().requestReset(ticket.id)
        },
        openOrder: (orderId) => actions.openOrder('1', orderId, api.panels[0]?.id ?? ''),
      })
    },
    [actions],
  )

  // Khôi phục bố cục đã lưu của tài khoản (hỏng thì dùng mẫu theo vai trò, kèm câu báo nhẹ).
  // Mở từ Ctrl+K "Mở phiếu Mua/Bán" (?phieu=mua|ban): mở phiếu ngay khi bàn làm việc sẵn sàng, rồi bỏ tham số.
  const requestedSide = searchParams.get('phieu')
  const onReady = useCallback(
    (event: DockviewReadyEvent) => {
      apiRef.current = event.api
      trackPopoutWindows(event.api)
      initialize(event.api)
      registerDemoBridge(event.api)
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
    [initialize, registerDemoBridge],
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
      {layouts.returned.length > 0 && (
        <div role="status" className="bg-nav-active flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-1.5 text-sm" data-testid="ws-returned">
          <span>
            {layouts.returned.length} panel đang ở cửa sổ tách đã được đưa về bàn làm việc khi tải lại trang (trình duyệt không tự mở
            lại cửa sổ).
          </span>
          <span className="flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={reopenNext} disabled={demoActive}>
              <ExternalLink aria-hidden /> Mở lại cửa sổ tách{layouts.returned.length > 1 ? ` (còn ${layouts.returned.length})` : ''}
            </Button>
            <button type="button" aria-label="Bỏ qua, để panel ở bàn làm việc" onClick={() => layouts.setReturned([])} className="rounded p-0.5">
              <X className="size-4" aria-hidden />
            </button>
          </span>
        </div>
      )}
      <div className="border-border min-h-0 flex-1 overflow-hidden rounded-lg border" data-demo-id="workspace-dock">
        <WorkspaceActionsContext.Provider value={actions}>
          <WindowHotkeys apiRef={apiRef} />
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
