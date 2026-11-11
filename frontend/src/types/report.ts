import type { MarketWindowStats } from './market'
import type { ChildOrder, Execution, MarketSnapshot, ParentOrder } from './order'

/**
 * Dữ liệu thô cho báo cáo hiệu quả thực hiện, đã lọc theo lệnh người dùng được xem.
 * Mọi chỉ số tính ở frontend bằng hàm thuần (src/utils/execQuality.ts).
 */
export interface ExecutionReportData {
  /** Ngày giao dịch hiện tại, YYYY-MM-DD. */
  trading_date: string
  /** Thời điểm hiện tại theo đồng hồ giả lập, mốc cuối khoảng của lệnh đang chạy. */
  now: string
  orders: ParentOrder[]
  children: ChildOrder[]
  executions: Execution[]
  /** Theo parent_order_id. */
  snapshots: Record<string, MarketSnapshot>
  /** KL và giá trị khớp toàn thị trường của mã trong khoảng [kích hoạt, hoàn tất / hiện tại], theo parent_order_id. */
  market: Record<string, MarketWindowStats>
}
