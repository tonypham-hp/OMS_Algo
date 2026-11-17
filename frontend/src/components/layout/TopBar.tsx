import { ChevronDown, ChevronRight, CircleHelp, LogOut, Search } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ROLE_LABELS } from '@/config/permissions'
import { LAYOUT } from '@/config/theme'
import { formatWallClock } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { useDemoStore } from '@/store/demo.store'
import { useMarketStore } from '@/store/market.store'
import { useUiStore } from '@/store/ui.store'
import { paletteShortcutLabel } from '@/utils/hotkey'
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
          // Dưới 1600px thanh trên chật (phiên, nút tua, nhãn dữ liệu, Demo): chỉ giữ tên màn hiện tại để nó không bị cắt;
          // cấp cha vẫn thấy ở thanh bên (mục đang chọn được tô sáng).
          return (
            <Fragment key={`${crumb.label}-${index}`}>
              {index > 0 && (
                <ChevronRight
                  className="text-muted-foreground hidden size-3.5 shrink-0 min-[1600px]:block"
                  aria-hidden
                />
              )}
              <li
                className={cn(
                  isLast ? 'truncate font-medium' : 'text-muted-foreground whitespace-nowrap',
                  !isLast && 'hidden min-[1600px]:list-item',
                )}
              >
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
    // Dưới 1600px thanh trên chật: bỏ chữ "cập nhật" để tên màn (breadcrumb) không bị cắt; title vẫn đủ câu.
    <span
      className="bg-price-ref/15 text-price-ref rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap"
      title={`Dữ liệu demo · cập nhật ${lastUpdate}`}
    >
      Dữ liệu demo · <span className="hidden min-[1600px]:inline">cập nhật </span>
      <span className="tabular-nums">{lastUpdate}</span>
    </span>
  )
}

/** Thanh trên của khung ứng dụng. `actions` là chỗ cắm chuông thông báo. */
export function TopBar({ actions }: { actions?: ReactNode }) {
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const demoActive = useDemoStore((state) => state.snapshot !== null)
  const setTourOpen = useUiStore((state) => state.setTourOpen)
  const setPaletteOpen = useUiStore((state) => state.setPaletteOpen)

  return (
    <header
      className="bg-sidebar border-sidebar-border sticky top-0 z-30 flex shrink-0 items-center gap-4 border-b px-4"
      style={{ height: LAYOUT.topBarHeight }}
    >
      <Breadcrumb />
      <PaletteButton />
      <div className="ml-auto flex shrink-0 items-center gap-3">
        <SessionStatus />
        {/* Đang Demo: chỗ này dành cho nhãn Demo; dữ liệu lúc đó là của kịch bản, không phải giá demo thường. */}
        {!demoActive && <DemoDataLabel />}
        {actions}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Tài khoản ${user.display_name}`}
                data-demo-id="account-menu"
                className="hover:bg-nav-active/60 flex items-center gap-1 rounded-md px-2 py-1 text-right leading-tight whitespace-nowrap"
              >
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{user.display_name}</span>
                  <span className="text-muted-foreground text-xs">
                    {user.username} · {ROLE_LABELS[user.role]}
                  </span>
                </span>
                <ChevronDown className="text-muted-foreground size-3.5" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {/* Tour không chạy khi đang Demo. */}
              <DropdownMenuItem disabled={demoActive} onSelect={() => setTourOpen(true)}>
                <CircleHelp aria-hidden />
                Xem hướng dẫn
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setPaletteOpen(true)}>
                <Search aria-hidden />
                Tìm nhanh
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={logout}>
                <LogOut aria-hidden />
                Đăng xuất
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button size="icon-sm" variant="ghost" aria-label="Đăng xuất" title="Đăng xuất" onClick={logout}>
          <LogOut aria-hidden />
        </Button>
      </div>
    </header>
  )
}

/** Nút mở hộp tìm nhanh, cùng tác dụng với Ctrl+K / Cmd+K. */
function PaletteButton() {
  const setPaletteOpen = useUiStore((state) => state.setPaletteOpen)
  const shortcut = paletteShortcutLabel()
  const label = `Tìm lệnh, mã, màn hình… ${shortcut}`
  return (
    // Thanh trên đã chật ở 1366–1440px (phiên, nút tua, nhãn dữ liệu, Demo): chữ và phím tắt chỉ hiện từ 1600px,
    // màn hẹp hơn chỉ còn biểu tượng; tên đọc cho trình đọc màn hình và title vẫn đủ câu.
    <button
      type="button"
      onClick={() => setPaletteOpen(true)}
      aria-label={label}
      title={label}
      aria-keyshortcuts="Control+K Meta+K"
      data-demo-id="palette-button"
      className="border-border-strong text-muted-foreground hover:text-foreground hover:bg-nav-active/60 flex h-8 shrink-0 items-center gap-2 rounded-md border px-2.5 text-sm"
    >
      <Search className="size-4 shrink-0" aria-hidden />
      <span className="hidden whitespace-nowrap min-[1600px]:inline" aria-hidden>
        Tìm lệnh, mã, màn hình…
      </span>
      <kbd className="bg-muted hidden rounded px-1.5 py-px font-mono text-[11px] whitespace-nowrap min-[1600px]:inline" aria-hidden>
        {shortcut}
      </kbd>
    </button>
  )
}
