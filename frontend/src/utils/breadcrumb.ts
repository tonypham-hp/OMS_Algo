import { NAV_SECTIONS } from '@/config/navigation'

export interface Crumb {
  label: string
  /** null: mục cuối, hoặc nhóm menu không có trang riêng. */
  path: string | null
}

const EXTRA_PAGES: Record<string, string> = {
  '/403': 'Không có quyền',
}

/** Đường dẫn → breadcrumb: nhóm menu › màn hình › mã lệnh (với /so-lenh/:id). */
export function getBreadcrumb(pathname: string): Crumb[] {
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (!item.path) continue
      const isPage = pathname === item.path
      const isChild = pathname.startsWith(`${item.path}/`)
      if (!isPage && !isChild) continue
      const crumbs: Crumb[] = section.title ? [{ label: section.title, path: null }] : []
      crumbs.push({ label: item.label, path: isChild ? item.path : null })
      if (isChild) crumbs.push({ label: decodeURIComponent(pathname.slice(item.path.length + 1)), path: null })
      return crumbs
    }
  }

  return [{ label: EXTRA_PAGES[pathname] ?? 'Không tìm thấy trang', path: null }]
}
