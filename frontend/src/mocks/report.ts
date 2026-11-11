import type {
  ChildOrder,
  DemoUser,
  Execution,
  ExecutionReportData,
  MarketSnapshot,
  MarketTrade,
  MarketWindowStats,
  ParentOrder,
} from '@/types'
import { getMarketWindow, summarizeTicks } from '@/utils/execQuality'
import { canSeeOrder } from './access'

/** Nguồn dữ liệu cho báo cáo. Tách khỏi runtime để test được mà không cần trình duyệt. */
export interface ReportSource {
  tradingDate: string
  now: string
  orders: ParentOrder[]
  children: ChildOrder[]
  executions: Execution[]
  getSnapshot: (parentOrderId: string) => MarketSnapshot | undefined
  listTicks: (symbol: string, from: string, to: string) => MarketTrade[]
}

/** KL và giá trị khớp toàn thị trường của mã trong khoảng của lệnh. Không có arrival thì null. */
export function getOrderMarketStats(
  order: ParentOrder,
  snapshot: MarketSnapshot | null,
  now: string,
  listTicks: ReportSource['listTicks'],
): MarketWindowStats | null {
  const window = getMarketWindow(order, snapshot, now)
  if (!window) return null
  return summarizeTicks(listTicks(order.symbol, window.from, window.to), window.from, window.to)
}

/** Dữ liệu báo cáo hiệu quả: chỉ lệnh người dùng được xem (cùng quy tắc với Sổ lệnh), bỏ lệnh nháp. */
export function buildExecutionReport(user: DemoUser, source: ReportSource): ExecutionReportData {
  const orders = source.orders.filter((order) => order.status !== 'DRAFT' && canSeeOrder(user, order))
  const visible = new Set(orders.map((order) => order.parent_order_id))
  const snapshots: ExecutionReportData['snapshots'] = {}
  const market: ExecutionReportData['market'] = {}
  for (const order of orders) {
    const id = order.parent_order_id
    const snapshot = source.getSnapshot(id) ?? null
    if (!snapshot) continue
    snapshots[id] = snapshot
    const stats = getOrderMarketStats(order, snapshot, source.now, source.listTicks)
    if (stats) market[id] = stats
  }
  return {
    trading_date: source.tradingDate,
    now: source.now,
    orders,
    children: source.children.filter((child) => visible.has(child.parent_order_id)),
    executions: source.executions.filter((execution) => visible.has(execution.parent_order_id)),
    snapshots,
    market,
  }
}
