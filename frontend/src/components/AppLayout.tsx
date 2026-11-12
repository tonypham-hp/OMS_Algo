import { Outlet } from 'react-router-dom'
import { ChecksPanel } from '@/components/demo/ChecksPanel'
import { DemoController } from '@/components/demo/DemoController'
import { DemoHighlight } from '@/components/demo/DemoHighlight'
import { DemoTopBar } from '@/components/demo/DemoTopBar'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { LAYOUT } from '@/config/theme'
import { useDemoRunner } from '@/demo/useDemoRunner'
import { useMarketStream } from '@/hooks/useMarketStream'
import { useNotificationSync } from '@/hooks/useNotificationSync'
import { useAuthStore } from '@/store/auth.store'
import { useDemoStore } from '@/store/demo.store'
import { useUiStore } from '@/store/ui.store'

/** Chừa chỗ dưới đáy cho khung điều khiển Demo, để phần cuối trang vẫn cuộn tới được. */
const DEMO_BOTTOM_SPACE = 240

/** Khung chung của mọi trang sau đăng nhập: thanh bên + thanh trên + nội dung. */
export function AppLayout() {
  useMarketStream()
  useNotificationSync()
  useDemoRunner()
  const role = useAuthStore((state) => state.user?.role)
  const collapsed = useUiStore((state) => state.sidebarCollapsed)
  const toggleSidebar = useUiStore((state) => state.toggleSidebar)
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
      <DemoController />
      <DemoHighlight />
      <ChecksPanel />
    </div>
  )
}
