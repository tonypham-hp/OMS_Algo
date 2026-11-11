import type { DemoUser, ParentOrder } from '@/types'

/** Khách hàng và dealer chỉ thấy tài khoản của mình, vận hành thấy tất cả. */
export function canSeeOrder(user: DemoUser, order: ParentOrder) {
  return user.role === 'OPS' || user.accounts.includes(order.account_no)
}
