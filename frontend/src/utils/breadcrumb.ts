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
  const [, first = '', second] = pathname.split('/')
  const basePath = `/${first}`

  for (const section of NAV_SECTIONS) {
    const item = section.items.find((entry) => entry.path === basePath)
    if (!item) continue
    const crumbs: Crumb[] = section.title ? [{ label: section.title, path: null }] : []
    crumbs.push({ label: item.label, path: second ? basePath : null })
    if (second) crumbs.push({ label: decodeURIComponent(second), path: null })
    return crumbs
  }

  return [{ label: EXTRA_PAGES[basePath] ?? 'Không tìm thấy trang', path: null }]
}
