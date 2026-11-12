import { parseTimeToSeconds } from '@/utils/hose'
import { getWorkingQty } from '../checks'
import { childrenOfRef } from '../state'
import type { DemoEnv, DemoState } from '../types'

// Dùng chung cho các kịch bản: mã CK, giờ bắt đầu, đường dẫn màn và các hàm đọc dữ liệu cho check.

/** Mọi kịch bản chạy trên FPT (tham chiếu 118.000, bước giá 100, trần 126.200, sàn 109.800). */
export const SYMBOL = 'FPT'
export const DETAIL_ROUTE = '/so-lenh/{order}'
export const BOOK_ROUTE = '/so-lenh'

/** Đưa thị trường vào phiên liên tục lúc 10:00 với giá khớp `price`. */
export function openMarketAt(env: DemoEnv, price: number) {
  env.simulator.jumpTo(parseTimeToSeconds('10:00') ?? 36_000)
  env.simulator.pushTrade(SYMBOL, price, 100)
  env.simulator.advance(1)
}

export function orderOf(state: DemoState, ref = 'order') {
  const order = state.orders.find((item) => item.parent_order_id === state.ctx.refs[ref])
  if (!order) throw new Error(`Không có lệnh "${ref}"`)
  return order
}

export function childrenOf(state: DemoState, ref = 'order') {
  return childrenOfRef(state, ref)
}

export function workingOf(state: DemoState, ref = 'order') {
  return getWorkingQty(state, orderOf(state, ref).parent_order_id)
}

export function remainingOf(state: DemoState, ref = 'order') {
  const order = orderOf(state, ref)
  return order.total_qty - order.executed_qty
}

/** Số event của lệnh có action cho trước. */
export function countEvents(state: DemoState, action: string, ref = 'order') {
  const id = state.ctx.refs[ref]
  return state.events.filter((event) => event.parent_order_id === id && event.action === action).length
}
