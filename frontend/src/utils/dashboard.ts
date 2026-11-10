import { REASON_LABELS } from '@/config/opsAlerts'
import { formatDateTime, formatNumber } from '@/lib/format'
import { EVENT_ACTION_LABELS, formatEventChange } from '@/pages/OrderDetail/eventFormat'
import { getEntryExecutions, getFillSummary } from '@/pages/OrderDetail/orderMetrics'
import type { ChildOrder, DashboardData, OrderEvent, ParentOrder } from '@/types'
import { isTerminalStatus } from './orderActions'

// Hàm thuần cho Trung tâm lệnh: nhận dữ liệu đã lọc theo quyền xem, không gọi API, không đọc store.

/** Lệnh đang chạy: chưa kết thúc (kể cả đang tạm dừng, đang hủy). Lệnh nháp chưa chạy. */
export function isLiveOrder(order: ParentOrder): boolean {
  return order.status !== 'DRAFT' && !isTerminalStatus(order.status)
}

export interface RunningStats {
  running: number
  paused: number
}

export function getRunningStats(orders: ParentOrder[]): RunningStats {
  const live = orders.filter(isLiveOrder)
  return {
    running: live.length,
    paused: live.filter((order) => order.status === 'PAUSED_USER' || order.status === 'PAUSED_SYSTEM').length,
  }
}

export interface FilledToday {
  /** KL khớp trong ngày giao dịch hiện tại (chỉ lệnh vào; lệnh thoát của Bracket không tính). */
  filled: number
  /** Tổng KL đặt của các lệnh trong ngày: đang chạy, hoặc tạo hôm nay. */
  ordered: number
}

export function getFilledToday(data: Pick<DashboardData, 'trading_date' | 'orders' | 'children' | 'executions'>): FilledToday {
  const isToday = (dateTime: string) => dateTime.startsWith(data.trading_date)
  let filled = 0
  let ordered = 0
  for (const order of data.orders) {
    const id = order.parent_order_id
    const fills = getEntryExecutions(
      order,
      data.children.filter((child) => child.parent_order_id === id),
      data.executions.filter((execution) => execution.parent_order_id === id),
    ).filter((execution) => isToday(execution.match_time))
    const filledToday = fills.reduce((sum, fill) => sum + fill.qty, 0)
    filled += filledToday
    if (isLiveOrder(order) || isToday(order.created_at) || filledToday > 0) ordered += order.total_qty
  }
  return { filled, ordered }
}

export type AttentionKind = 'UNKNOWN' | 'REJECTED' | 'PAUSED_SYSTEM'

export interface AttentionItem {
  order: ParentOrder
  kind: AttentionKind
  /** Số lệnh con gặp vấn đề (với UNKNOWN, REJECTED); 1 với PAUSED_SYSTEM. */
  count: number
  issue: string
}

export interface AttentionSummary {
  items: AttentionItem[]
  /** Số lệnh (không trùng) cần chú ý. */
  orders: number
  /** Số lệnh con UNKNOWN, lệnh con REJECTED, lệnh cha PAUSED_SYSTEM. */
  counts: Record<AttentionKind, number>
}

/**
 * Lý do hệ thống tạm dừng: ưu tiên reason_code; lệnh không có reason_code thì dùng nội dung thông báo tạm dừng
 * (bỏ phần "Lệnh … tạm dừng:" vì bảng đã có mã lệnh).
 */
function describePause(order: ParentOrder, notice: string | undefined): string {
  if (order.reason_code) return `Hệ thống tạm dừng: ${REASON_LABELS[order.reason_code].toLowerCase()}`
  const detail = notice?.replace(/^Lệnh \S+ tạm dừng:\s*/, '').replace(/\.$/, '')
  return detail ? `Hệ thống tạm dừng: ${detail}` : 'Hệ thống tạm dừng lệnh'
}

const KIND_ORDER: Record<AttentionKind, number> = { UNKNOWN: 0, REJECTED: 1, PAUSED_SYSTEM: 2 }

/**
 * Cùng quy tắc với cảnh báo ở Màn 4: lệnh con UNKNOWN / REJECTED của lệnh chưa kết thúc,
 * và lệnh cha đang bị hệ thống tạm dừng. Mỗi lệnh một dòng cho mỗi loại vấn đề.
 */
export function getAttention(
  orders: ParentOrder[],
  children: ChildOrder[],
  pauseReasons: Record<string, string> = {},
): AttentionSummary {
  const items: AttentionItem[] = []
  for (const order of orders) {
    if (order.status === 'PAUSED_SYSTEM') {
      items.push({ order, kind: 'PAUSED_SYSTEM', count: 1, issue: describePause(order, pauseReasons[order.parent_order_id]) })
    }
    if (!isLiveOrder(order)) continue
    const own = children.filter((child) => child.parent_order_id === order.parent_order_id)
    const unknown = own.filter((child) => child.status === 'UNKNOWN').length
    const rejected = own.filter((child) => child.status === 'REJECTED').length
    if (unknown > 0) {
      items.push({ order, kind: 'UNKNOWN', count: unknown, issue: `${unknown} lệnh con mất phản hồi từ Core, chờ đối soát` })
    }
    if (rejected > 0) {
      items.push({ order, kind: 'REJECTED', count: rejected, issue: `${rejected} lệnh con bị Core từ chối` })
    }
  }
  items.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || b.order.updated_at.localeCompare(a.order.updated_at))

  const counts: Record<AttentionKind, number> = { UNKNOWN: 0, REJECTED: 0, PAUSED_SYSTEM: 0 }
  for (const item of items) counts[item.kind] += item.count
  return { items, orders: new Set(items.map((item) => item.order.parent_order_id)).size, counts }
}

/**
 * Slippage bình quân so với giá arrival, theo bps, gia quyền theo KL khớp.
 * Dương là bất lợi: mua cao hơn hoặc bán thấp hơn arrival. null khi chưa có lệnh nào vừa khớp vừa có arrival.
 */
export function getAverageSlippageBps(
  data: Pick<DashboardData, 'orders' | 'children' | 'executions' | 'snapshots'>,
): number | null {
  let weighted = 0
  let totalQty = 0
  for (const order of data.orders) {
    const id = order.parent_order_id
    const children = data.children.filter((child) => child.parent_order_id === id)
    const executions = data.executions.filter((execution) => execution.parent_order_id === id)
    const summary = getFillSummary(order, children, executions, data.snapshots[id] ?? null)
    if (summary.differenceBps === null) continue
    const qty = getEntryExecutions(order, children, executions).reduce((sum, fill) => sum + fill.qty, 0)
    const cost = order.side === 'BUY' ? summary.differenceBps : -summary.differenceBps
    weighted += cost * qty
    totalQty += qty
  }
  return totalQty > 0 ? weighted / totalQty : null
}

export interface ActivityItem {
  event_id: string
  parent_order_id: string
  /** hh:mm:ss nếu trong ngày giao dịch hiện tại, "dd/MM hh:mm:ss" nếu là ngày khác. */
  time: string
  description: string
}

/** Mô tả một event bằng tiếng Việt, kèm mã lệnh (và lệnh con nếu có). */
export function describeEvent(event: OrderEvent): string {
  const target = event.child_order_id
    ? `${event.parent_order_id} › ${event.child_order_id}`
    : event.parent_order_id
  return `${EVENT_ACTION_LABELS[event.action]} ${target}: ${formatEventChange(event)}`
}

/** `limit` event mới nhất. `events` theo thứ tự xảy ra (cũ → mới) như engine trả về. */
export function getRecentActivity(events: OrderEvent[], limit = 10, tradingDate = ''): ActivityItem[] {
  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => b.event.event_time.localeCompare(a.event.event_time) || b.index - a.index)
    .slice(0, limit)
    .map(({ event }) => ({
      event_id: event.event_id,
      parent_order_id: event.parent_order_id,
      time:
        tradingDate && event.event_time.startsWith(tradingDate)
          ? (event.event_time.split('T')[1] ?? event.event_time)
          : formatDateTime(event.event_time),
      description: describeEvent(event),
    }))
}

/** "1.200 / 5.000" */
export function formatFilledRatio({ filled, ordered }: FilledToday): string {
  return `${formatNumber(filled)} / ${formatNumber(ordered)}`
}
