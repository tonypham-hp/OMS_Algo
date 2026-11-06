import { NavLink, Outlet } from 'react-router-dom'
import { SessionClock } from '@/components/SessionClock'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MENU_ITEMS, ROLE_LABELS } from '@/config/permissions'
import { useMarketStream } from '@/hooks/useMarketStream'
import { usePermission } from '@/hooks/usePermission'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'

export function AppLayout() {
  useMarketStream()
  const hasPermission = usePermission()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)

  return (
    <div className="flex min-h-svh flex-col">
      <header className="bg-card flex flex-wrap items-center gap-x-6 gap-y-2 border-b px-4 py-2">
        <span className="font-semibold tracking-wide">OMS</span>
        <nav className="flex flex-wrap gap-1" aria-label="Menu chính">
          {MENU_ITEMS.filter((item) => hasPermission(item.permission)).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'hover:bg-accent rounded-md px-3 py-1.5 text-sm',
                  isActive ? 'bg-accent font-medium' : 'text-muted-foreground',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2">
          <Badge className="bg-amber-500/20 text-amber-300">Dữ liệu demo</Badge>
          <SessionClock />
          {user && (
            <span className="text-muted-foreground text-sm whitespace-nowrap">
              {user.display_name} ({ROLE_LABELS[user.role]})
            </span>
          )}
          <Button size="sm" variant="outline" onClick={logout}>
            Đăng xuất
          </Button>
        </div>
      </header>
      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  )
}
