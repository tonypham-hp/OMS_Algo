import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { useMarketStream } from '@/hooks/useMarketStream'
import { useAuthStore } from '@/store/auth.store'
import { useUiStore } from '@/store/ui.store'

/** Khung chung của mọi trang sau đăng nhập: thanh bên + thanh trên + nội dung. */
export function AppLayout() {
  useMarketStream()
  const role = useAuthStore((state) => state.user?.role)
  const collapsed = useUiStore((state) => state.sidebarCollapsed)
  const toggleSidebar = useUiStore((state) => state.toggleSidebar)

  return (
    <div className="flex min-h-svh">
      {role && <Sidebar role={role} collapsed={collapsed} onToggle={toggleSidebar} />}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="min-w-0 flex-1 p-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
