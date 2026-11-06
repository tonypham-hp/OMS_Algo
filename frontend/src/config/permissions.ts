import type { Role } from '@/types'

export type Permission =
  | 'place_order'
  | 'order_book'
  | 'multi_account'
  | 'operations'
  | 'strategy_config'

const CUSTOMER_PERMISSIONS: Permission[] = ['place_order', 'order_book']

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  CUSTOMER: CUSTOMER_PERMISSIONS,
  DEALER: [...CUSTOMER_PERMISSIONS, 'multi_account'],
  OPS: [...CUSTOMER_PERMISSIONS, 'operations', 'strategy_config'],
}

export const ROLE_LABELS: Record<Role, string> = {
  CUSTOMER: 'Khách hàng',
  DEALER: 'Dealer',
  OPS: 'Vận hành',
}

export const MENU_ITEMS: ReadonlyArray<{ path: string; label: string; permission: Permission }> = [
  { path: '/dat-lenh', label: 'Đặt lệnh', permission: 'place_order' },
  { path: '/so-lenh', label: 'Sổ lệnh', permission: 'order_book' },
  { path: '/van-hanh', label: 'Vận hành', permission: 'operations' },
  { path: '/cau-hinh', label: 'Cấu hình', permission: 'strategy_config' },
]
