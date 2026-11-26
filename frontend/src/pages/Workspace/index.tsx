import 'dockview-react/dist/styles/dockview.css'
import '@/styles/workspace.css'
import { DockviewReact, type DockviewReadyEvent, type DockviewTheme } from 'dockview-react'
import { useCallback } from 'react'
import { LAYOUT } from '@/config/theme'
import { useAuthStore } from '@/store/auth.store'
import { PANEL_COMPONENTS } from '@/workspace/panels'
import { applyPreset } from '@/workspace/presets'
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

  const onReady = useCallback(
    (event: DockviewReadyEvent) => applyPreset(event.api, role === 'CUSTOMER' ? 'basic' : 'pro'),
    [role],
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
        <DockviewReact
          theme={OMS_DOCK_THEME}
          components={PANEL_COMPONENTS}
          defaultTabComponent={PanelTab}
          rightHeaderActionsComponent={GroupActions}
          onReady={onReady}
          floatingGroupBounds="boundedWithinViewport"
        />
      </div>
    </div>
  )
}
