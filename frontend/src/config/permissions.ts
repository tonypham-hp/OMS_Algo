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
