import type { ParentOrder } from '@/types'
import type { DateRange } from '@/utils/dateRange'
import type { ReconInput } from '@/utils/reconcile'
import type { OrderEngine } from './engine'

/** Dữ liệu đối soát lấy từ engine: lệnh (đã lọc theo quyền xem), lệnh con, khớp, event và sổ phía Core. */
export function reconInputFromEngine(
  engine: OrderEngine,
  range: DateRange,
  now: string,
  canSee: (order: ParentOrder) => boolean = () => true,
): ReconInput {
  const orders = engine.listOrders().filter(canSee)
  const visible = new Set(orders.map((order) => order.parent_order_id))
  const isVisible = (item: { parent_order_id: string }) => visible.has(item.parent_order_id)
  return {
    ...range,
    now,
    orders,
    children: engine.listChildren().filter(isVisible),
    executions: engine.listExecutions().filter(isVisible),
    events: engine.listEvents().filter(isVisible),
    coreLedger: engine.listCoreLedger().filter(isVisible),
  }
}
