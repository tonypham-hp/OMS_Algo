import { ChevronRight, LogOut } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ROLE_LABELS } from '@/config/permissions'
import { LAYOUT } from '@/config/theme'
import { formatWallClock } from '@/lib/format'
import { useAuthStore } from '@/store/auth.store'
import { useMarketStore } from '@/store/market.store'
import { getBreadcrumb } from '@/utils/breadcrumb'
import { SessionStatus } from './SessionStatus'

function Breadcrumb() {
  const { pathname } = useLocation()
  const crumbs = getBreadcrumb(pathname)
  return (
    <nav aria-label="Vị trí" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 text-sm">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1
          return (
            <Fragment key={`${crumb.label}-${index}`}>
              {index > 0 && <ChevronRight className="text-muted-foreground size-3.5 shrink-0" aria-hidden />}
              <li className={isLast ? 'truncate font-medium' : 'text-muted-foreground whitespace-nowrap'}>
                {crumb.path ? (
                  <Link to={crumb.path} className="hover:text-foreground">
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current={isLast ? 'page' : undefined}>{crumb.label}</span>
                )}
              </li>
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}

/** Nhãn dữ liệu demo kèm giờ thật lần cuối nhận giá (trừ đi độ trễ nếu luồng giá đang ngừng). */
function DemoDataLabel() {
  const receivedAt = useMarketStore((state) => state.received_at)
  const quoteAge = useMarketStore((state) => state.quote_age_seconds)
  const lastUpdate = receivedAt > 0 ? formatWallClock(receivedAt - quoteAge * 1000) : '--:--:--'
  return (
    <span className="bg-price-ref/15 text-price-ref rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap">
      Dữ liệu demo · cập nhật <span className="tabular-nums">{lastUpdate}</span>
    </span>
  )
}

/** Thanh trên của khung ứng dụng. `actions` là chỗ cắm chuông thông báo. */
export function TopBar({ actions }: { actions?: ReactNode }) {
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)

  return (
    <header
      className="bg-sidebar border-sidebar-border sticky top-0 z-30 flex shrink-0 items-center gap-4 border-b px-4"
      style={{ height: LAYOUT.topBarHeight }}
    >
      <Breadcrumb />
      <div className="ml-auto flex shrink-0 items-center gap-3">
        <SessionStatus />
        <DemoDataLabel />
        {actions}
        {user && (
          <span className="flex flex-col text-right leading-tight whitespace-nowrap">
            <span className="text-sm font-medium">{user.display_name}</span>
            <span className="text-muted-foreground text-xs">
              {user.username} · {ROLE_LABELS[user.role]}
            </span>
          </span>
        )}
        <Button size="icon-sm" variant="ghost" aria-label="Đăng xuất" title="Đăng xuất" onClick={logout}>
          <LogOut aria-hidden />
        </Button>
      </div>
    </header>
  )
}
