import type { DemoUser, ParentOrder } from '@/types'

/** Khách hàng và dealer chỉ thấy tài khoản của mình, vận hành thấy tất cả. */
export function canSeeOrder(user: DemoUser, order: ParentOrder) {
  return canSeeAccount(user, order.account_no)
}

/** Cùng quy tắc cho mọi thứ gắn với tài khoản (lệnh thỏa thuận…). */
export function canSeeAccount(user: DemoUser, accountNo: string) {
  return user.role === 'OPS' || user.accounts.includes(accountNo)
}
