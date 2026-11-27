import { lazy, Suspense, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { DemoTopBar } from '@/components/demo/DemoTopBar'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { CommandPalette } from '@/components/palette/CommandPalette'
import { usePaletteHotkey } from '@/components/palette/usePaletteHotkey'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { LAYOUT } from '@/config/theme'
import { canUseDemo } from '@/demo/access'
import { NARROW_SCREEN_QUERY, useMediaQuery } from '@/hooks/useMediaQuery'
import { useMarketStream } from '@/hooks/useMarketStream'
import { ShortcutSheet } from '@/hotkeys/ShortcutSheet'
import { TourOverlay } from '@/tour/TourOverlay'
import { useNotificationSync } from '@/hooks/useNotificationSync'
import { useAuthStore } from '@/store/auth.store'
import { useDemoStore } from '@/store/demo.store'
import { useUiStore } from '@/store/ui.store'
import { installWindowSafety } from '@/workspace/windows'

/** Phần chạy Chế độ Demo: chỉ tải khi vai trò được dùng Demo. */
const DemoLayer = lazy(() => import('@/components/demo/DemoLayer'))

/** Chừa chỗ dưới đáy cho khung điều khiển Demo, để phần cuối trang vẫn cuộn tới được. */
const DEMO_BOTTOM_SPACE = 240

/** Khung chung của mọi trang sau đăng nhập: thanh bên + thanh trên + nội dung. */
export function AppLayout() {
  useMarketStream()
  useNotificationSync()
  usePaletteHotkey()
  // Đợt 10B: đăng xuất hoặc bắt đầu Demo thì đóng mọi cửa sổ tách, phiếu mini.
  useEffect(
    () =>
      installWindowSafety({
        onLogout: (close) => useAuthStore.subscribe((state, previous) => previous.user && !state.user && close()),
        onDemoStart: (close) => useDemoStore.subscribe((state, previous) => !previous.snapshot && state.snapshot && close()),
      }),
    [],
  )
  const role = useAuthStore((state) => state.user?.role)
  const savedCollapsed = useUiStore((state) => state.sidebarCollapsed)
  const toggleSaved = useUiStore((state) => state.toggleSidebar)
  // Màn hẹp (≤1280px): luôn thu gọn khi vào; người dùng vẫn mở tạm được, nhưng không ghi đè lựa chọn đã lưu cho màn rộng.
  const narrow = useMediaQuery(NARROW_SCREEN_QUERY)
  const [narrowExpanded, setNarrowExpanded] = useState(false)
  const collapsed = narrow ? !narrowExpanded : savedCollapsed
  const toggleSidebar = narrow ? () => setNarrowExpanded((value) => !value) : toggleSaved
  const demoActive = useDemoStore((state) => state.snapshot !== null)
  const checksOpen = useDemoStore((state) => state.checksOpen)

  return (
    <div className="flex min-h-svh">
      {role && <Sidebar role={role} collapsed={collapsed} onToggle={toggleSidebar} />}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          actions={
            <>
              <DemoTopBar />
              <NotificationBell />
            </>
          }
        />
        <main
          className="min-w-0 flex-1 p-4"
          style={
            demoActive
              ? { paddingRight: checksOpen ? LAYOUT.demoChecksWidth + 16 : 16, paddingBottom: DEMO_BOTTOM_SPACE }
              : undefined
          }
        >
          <Outlet />
        </main>
      </div>
      <CommandPalette />
      <ShortcutSheet />
      <TourOverlay />
      {canUseDemo(role) && (
        <Suspense fallback={null}>
          <DemoLayer />
        </Suspense>
      )}
    </div>
  )
}
