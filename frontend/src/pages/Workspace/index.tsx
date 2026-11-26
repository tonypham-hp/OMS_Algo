import 'dockview-react/dist/styles/dockview.css'
import '@/styles/workspace.css'
import { DockviewReact, type DockviewApi, type DockviewReadyEvent, type DockviewTheme } from 'dockview-react'
import { useCallback, useMemo, useRef } from 'react'
import { LAYOUT } from '@/config/theme'
import { useAuthStore } from '@/store/auth.store'
import { useWorkspaceStore } from '@/store/workspace.store'
import type { PanelParams } from '@/workspace/panelTypes'
import { PANEL_COMPONENTS } from '@/workspace/panels'
import { addWorkspacePanel, applyPreset, panelKind } from '@/workspace/presets'
import { WorkspaceActionsContext, type WorkspaceActions } from '@/workspace/workspaceContext'
import { GroupActions } from './GroupActions'
import { PanelTab } from './PanelTab'

/** Theme dockview riêng: biến --dv-* trỏ về token (src/styles/workspace.css), tự theo 4 theme và bảng màu mù màu. */
const OMS_DOCK_THEME: DockviewTheme = { name: 'oms', className: 'dockview-theme-oms', dndOverlayMounting: 'absolute' }

/**
 * Bàn làm việc (Đợt 10A): nhiều panel dock được, kéo tab để dock trái/phải/trên/dưới hoặc gộp tab,
 * kéo viền để đổi kích thước, thả nổi một panel. Panel dùng lại component của các màn có sẵn.
 */
export default function Workspace() {
  const role = useAuthStore((state) => state.user?.role)
  const apiRef = useRef<DockviewApi | null>(null)

  const onReady = useCallback(
    (event: DockviewReadyEvent) => {
      apiRef.current = event.api
      applyPreset(event.api, role === 'CUSTOMER' ? 'basic' : 'pro')
    },
    [role],
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
      </div>
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
