import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { getNavSections, type NavItem } from '@/config/navigation'
import { LAYOUT } from '@/config/theme'
import { cn } from '@/lib/utils'
import type { Role } from '@/types'

interface SidebarProps {
  role: Role
  collapsed: boolean
  onToggle: () => void
}

const ITEM_CLASS = 'flex h-9 items-center gap-3 rounded-md px-3 text-sm'

function ComingSoonItem({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const Icon = item.icon
  return (
    <span
      aria-disabled="true"
      title={`${item.label} (sắp có)`}
      className={cn(ITEM_CLASS, 'text-muted-foreground/60 cursor-not-allowed', collapsed && 'justify-center px-0')}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {collapsed ? (
        <span className="sr-only">{item.label} (sắp có)</span>
      ) : (
        <>
          <span className="truncate">{item.label}</span>
          <span className="border-border-strong ml-auto rounded border px-1.5 py-px text-[10px] leading-4 whitespace-nowrap">
            Sắp có
          </span>
        </>
      )}
    </span>
  )
}

function LinkItem({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.path!}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          ITEM_CLASS,
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-nav-active text-primary font-medium'
            : 'text-muted-foreground hover:bg-nav-active/60 hover:text-foreground',
        )
      }
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
    </NavLink>
  )
}

/** Thanh bên: menu theo vai trò. Mục "Sắp có" bị khóa, không điều hướng. */
export function Sidebar({ role, collapsed, onToggle }: SidebarProps) {
  const sections = getNavSections(role)
  const width = collapsed ? LAYOUT.sidebarCollapsedWidth : LAYOUT.sidebarWidth

  return (
    <aside
      className="bg-sidebar border-sidebar-border sticky top-0 flex h-svh shrink-0 flex-col border-r transition-[width] duration-200"
      style={{ width }}
    >
      <div
        className={cn('flex shrink-0 items-center gap-2 border-b px-4', collapsed && 'justify-center px-0')}
        style={{ height: LAYOUT.topBarHeight }}
      >
        <span className="bg-primary text-primary-foreground grid size-7 shrink-0 place-items-center rounded-md text-xs font-bold">
          A
        </span>
        {!collapsed && <span className="font-semibold tracking-wide whitespace-nowrap">ALGO OMS</span>}
      </div>
      <nav aria-label="Menu chính" className="flex-1 overflow-y-auto px-2 py-3">
        {sections.map((section) => (
          <div key={section.title ?? 'root'} className="mb-3">
            {section.title &&
              (collapsed ? (
                <div className="border-border mx-2 my-2 border-t" aria-hidden />
              ) : (
                <p className="text-muted-foreground/80 px-3 pt-2 pb-1 text-[11px] font-medium tracking-wider uppercase">
                  {section.title}
                </p>
              ))}
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => (
                <li key={item.label}>
                  {item.comingSoon || !item.path ? (
                    <ComingSoonItem item={item} collapsed={collapsed} />
                  ) : (
                    <LinkItem item={item} collapsed={collapsed} />
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
        aria-expanded={!collapsed}
        className={cn(
          'text-muted-foreground hover:text-foreground flex h-11 shrink-0 items-center gap-3 border-t px-5 text-sm',
          collapsed && 'justify-center px-0',
        )}
      >
        {collapsed ? <PanelLeftOpen className="size-4" aria-hidden /> : <PanelLeftClose className="size-4" aria-hidden />}
        {!collapsed && <span>Thu gọn</span>}
      </button>
    </aside>
  )
}
