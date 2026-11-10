import type { OrderEvent } from './event'
import type { ChildOrder, Execution, MarketSnapshot, ParentOrder } from './order'

/**
 * Dữ liệu thô cho Trung tâm lệnh, đã lọc theo lệnh người dùng được xem. Ngoài ERD: là phép gộp các bảng sẵn có,
 * mọi con số được tính ở frontend bằng hàm thuần (src/utils/dashboard.ts).
 */
export interface DashboardData {
  /** Ngày giao dịch hiện tại, YYYY-MM-DD. */
  trading_date: string
  orders: ParentOrder[]
  children: ChildOrder[]
  executions: Execution[]
  /** Theo parent_order_id; lệnh đặt lúc chưa có giá thì không có. */
  snapshots: Record<string, MarketSnapshot>
  /** Lý do tạm dừng gần nhất của lệnh PAUSED_SYSTEM (từ Notification PARENT_PAUSED), theo parent_order_id. */
  pause_reasons: Record<string, string>
  /** Theo thứ tự xảy ra (cũ → mới), tối đa DASHBOARD_EVENT_LIMIT event gần nhất. */
  events: OrderEvent[]
}
