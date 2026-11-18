import type { Role } from '@/types'

export type Permission =
  | 'place_order'
  | 'order_book'
  | 'multi_account'
  | 'operations'
  | 'strategy_config'
  /** Xem tab Đối soát, bấm Đối soát ngay. */
  | 'reconciliation'
  /** Đánh dấu đã xử lý, duyệt chênh lệch đối soát (maker-checker). */
  | 'reconcile_resolve'

const CUSTOMER_PERMISSIONS: Permission[] = ['place_order', 'order_book']

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  CUSTOMER: CUSTOMER_PERMISSIONS,
  DEALER: [...CUSTOMER_PERMISSIONS, 'multi_account', 'reconciliation'],
  OPS: [...CUSTOMER_PERMISSIONS, 'operations', 'strategy_config', 'reconciliation', 'reconcile_resolve'],
}

export const ROLE_LABELS: Record<Role, string> = {
  CUSTOMER: 'Khách hàng',
  DEALER: 'Dealer',
  OPS: 'Vận hành',
}
