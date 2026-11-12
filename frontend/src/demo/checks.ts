import { CHILD_STATUS_STYLES, PARENT_STATUS_STYLES } from '@/config/orderStatus'
import { isChildLive } from '@/mocks/engine'
import { getEntryExecutions } from '@/pages/OrderDetail/orderMetrics'
import type { Check, DemoState } from './types'

// Check dùng chung cho mọi kịch bản, theo quy tắc lõi (mục 8 của docs/frontend-spec.md).
// Chạy sau MỖI bước; một lần sai là điều kiện đó KHÔNG ĐẠT.

const PARENT_STATUSES = new Set(Object.keys(PARENT_STATUS_STYLES))
const CHILD_STATUSES = new Set(Object.keys(CHILD_STATUS_STYLES))

function ownChildren(state: DemoState, parentOrderId: string) {
  return state.children.filter((child) => child.parent_order_id === parentOrderId)
}

function ownExecutions(state: DemoState, parentOrderId: string) {
  return state.executions.filter((execution) => execution.parent_order_id === parentOrderId)
}

/** KL đang chờ của lệnh vào: lệnh con còn sống (kể cả UNKNOWN) trừ phần đã khớp. */
export function getWorkingQty(state: DemoState, parentOrderId: string) {
  const order = state.orders.find((item) => item.parent_order_id === parentOrderId)
  return ownChildren(state, parentOrderId)
    .filter((child) => child.side === order?.side && isChildLive(child.status))
    .reduce((sum, child) => sum + child.quantity - child.filled_qty, 0)
}

const noOverfill: Check = {
  label: 'Tổng khớp không vượt tổng KL của lệnh cha',
  fn: (state) =>
    state.orders.every((order) => {
      const filled = getEntryExecutions(order, ownChildren(state, order.parent_order_id), ownExecutions(state, order.parent_order_id))
        .reduce((sum, execution) => sum + execution.qty, 0)
      return order.executed_qty <= order.total_qty && filled <= order.total_qty
    }),
}

const executedMatches: Check = {
  label: 'executed_qty bằng tổng các lần khớp (Execution) của lệnh',
  fn: (state) =>
    state.orders.every((order) => {
      const filled = getEntryExecutions(order, ownChildren(state, order.parent_order_id), ownExecutions(state, order.parent_order_id))
        .reduce((sum, execution) => sum + execution.qty, 0)
      return order.executed_qty === filled
    }),
}

const allowedFormula: Check = {
  label: 'allowed = total − executed − working (UNKNOWN vẫn tính là working)',
  fn: (state) =>
    state.orders.every((order) => {
      const allowed = order.total_qty - order.executed_qty - getWorkingQty(state, order.parent_order_id)
      return allowed >= 0 && state.env.engine.getAllowedQty(order.parent_order_id) === allowed
    }),
}

const uniqueChildIds: Check = {
  label: 'Không có lệnh con trùng client_order_id / idempotency_key',
  fn: (state) => {
    const clientIds = new Set(state.children.map((child) => child.client_order_id))
    const keys = new Set(state.children.map((child) => child.idempotency_key))
    return clientIds.size === state.children.length && keys.size === state.children.length
  },
}

const uniqueMatches: Check = {
  label: 'Mỗi exchange_match_id chỉ được ghi nhận một lần (báo khớp trùng bị bỏ qua)',
  fn: (state) => new Set(state.executions.map((execution) => execution.exchange_match_id)).size === state.executions.length,
}

const statusHasEvent: Check = {
  label: 'Mọi trạng thái hiện tại của lệnh cha, lệnh con đều có OrderEvent ghi nhận',
  fn: (state) => {
    // Event cuối cùng mang trạng thái của từng lệnh. Bỏ event hủy điều kiện (OCO) vì new_value cũng là CANCELLED.
    const lastParent = new Map<string, string>()
    const lastChild = new Map<string, string>()
    for (const event of state.events) {
      if (event.new_value === null) continue
      if (event.child_order_id === null) {
        if (PARENT_STATUSES.has(event.new_value) && !event.old_value?.startsWith('CONDITION:')) {
          lastParent.set(event.parent_order_id, event.new_value)
        }
      } else if (CHILD_STATUSES.has(event.new_value)) {
        lastChild.set(event.child_order_id, event.new_value)
      }
    }
    return (
      state.orders.every((order) => lastParent.get(order.parent_order_id) === order.status) &&
      state.children.every((child) => lastChild.get(child.child_order_id) === child.status)
    )
  },
}

/** Check dùng chung, theo thứ tự hiển thị. */
export const GENERAL_CHECKS: ReadonlyArray<Check> = [
  noOverfill,
  executedMatches,
  allowedFormula,
  uniqueChildIds,
  uniqueMatches,
  statusHasEvent,
]
