import type { ParentOrder } from '@/types'

/** Giá trị đại diện cho "tất cả", vì ô chọn của shadcn không nhận chuỗi rỗng. */
export const ALL = 'ALL'

export interface OrderFilterValues {
  status: string
  symbol: string
  side: string
  strategy_type: string
  account_no: string
}

export const EMPTY_FILTERS: OrderFilterValues = {
  status: ALL,
  symbol: ALL,
  side: ALL,
  strategy_type: ALL,
  account_no: ALL,
}

export function filterOrders(orders: ParentOrder[], filters: OrderFilterValues): ParentOrder[] {
  const matches = (selected: string, value: string) => selected === ALL || selected === value
  return orders.filter(
    (order) =>
      matches(filters.status, order.status) &&
      matches(filters.symbol, order.symbol) &&
      matches(filters.side, order.side) &&
      matches(filters.strategy_type, order.strategy_type) &&
      matches(filters.account_no, order.account_no),
  )
}
