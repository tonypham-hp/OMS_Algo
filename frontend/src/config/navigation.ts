import {
  Activity,
  ChartLine,
  History,
  LayoutDashboard,
  LayoutTemplate,
  ListOrdered,
  SlidersHorizontal,
  SquarePen,
  type LucideIcon,
} from 'lucide-react'
import type { Role } from '@/types'
import { ROLE_PERMISSIONS, type Permission } from './permissions'

export interface NavItem {
  label: string
  icon: LucideIcon
  /** Không có path với mục "Sắp có". */
  path?: string
  /** Không khai báo: mọi người đã đăng nhập đều thấy. */
  permission?: Permission
  comingSoon?: boolean
}

export interface NavSection {
  /** null: nhóm không có tiêu đề (Trung tâm lệnh). */
  title: string | null
  items: NavItem[]
}

export const NAV_SECTIONS: ReadonlyArray<NavSection> = [
  {
    title: null,
    items: [{ label: 'Trung tâm lệnh', icon: LayoutDashboard, path: '/trung-tam' }],
  },
  {
    title: 'Giao dịch',
    items: [
      { label: 'Đặt lệnh', icon: SquarePen, path: '/dat-lenh', permission: 'place_order' },
      { label: 'Sổ lệnh', icon: ListOrdered, path: '/so-lenh', permission: 'order_book' },
      { label: 'Mẫu chiến lược', icon: LayoutTemplate, comingSoon: true },
    ],
  },
  {
    title: 'Báo cáo',
    items: [
      { label: 'Hiệu quả thực hiện', icon: ChartLine, path: '/bao-cao/hieu-qua' },
      { label: 'Lịch sử và đối soát', icon: History, comingSoon: true },
    ],
  },
  {
    title: 'Vận hành',
    items: [
      { label: 'Giám sát hệ thống', icon: Activity, path: '/van-hanh', permission: 'operations' },
      { label: 'Cấu hình chiến lược', icon: SlidersHorizontal, path: '/cau-hinh', permission: 'strategy_config' },
    ],
  },
]

/** Nhóm "Vận hành" là nhóm chỉ có quyền vận hành: role khác không thấy cả nhóm, kể cả mục "Sắp có". */
const OPS_SECTION_TITLE = 'Vận hành'

function canSee(role: Role, item: NavItem) {
  return item.permission === undefined || ROLE_PERMISSIONS[role].includes(item.permission)
}

/** Menu theo vai trò: bỏ mục thiếu quyền, bỏ nhóm rỗng. */
export function getNavSections(role: Role): NavSection[] {
  return NAV_SECTIONS.filter((section) => section.title !== OPS_SECTION_TITLE || ROLE_PERMISSIONS[role].includes('operations'))
    .map((section) => ({ ...section, items: section.items.filter((item) => canSee(role, item)) }))
    .filter((section) => section.items.length > 0)
}

/** Các màn một vai trò mở được (không tính mục "Sắp có"), để ghi trên thẻ chọn tài khoản. */
export function getAccessibleLabels(role: Role): string[] {
  return getNavSections(role).flatMap((section) =>
    section.items.filter((item) => !item.comingSoon).map((item) => item.label),
  )
}
