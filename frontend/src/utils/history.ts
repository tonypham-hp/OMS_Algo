// Tab Lịch sử lệnh: hàm thuần dựng dòng, lọc, sắp xếp, phân trang, dòng tổng và CSV.
import { PARENT_STATUS_STYLES } from '@/config/orderStatus'
import { SIDE_LABELS, STRATEGIES } from '@/config/strategies'
import type { HistoryData, OrderEvent, ParentOrder, ParentOrderStatus } from '@/types'
import { toCsv, toCsvNumber, type CsvCell } from './csv'
import { defaultDateRange, resolveDateRange, type DateRange, type DateRangeValue } from './dateRange'
import { ALL, getExecQuality, type SortDirection } from './execQuality'
import { isTerminalStatus } from './orderActions'

export const HISTORY_PAGE_SIZE = 50

/** Lệnh cha đã kết thúc, hoặc lệnh nhiều phiên còn chạy. */
export function isHistoryOrder(order: ParentOrder): boolean {
  if (order.status === 'COMPLETED' || order.status === 'CANCELLED' || order.status === 'EXPIRED') return true
  return order.persistence_mode !== 'DAY' && order.status !== 'DRAFT' && !isTerminalStatus(order.status)
}

/** Số phiên đã chạy: phiên đầu, cộng một phiên cho mỗi lần mang phần còn lại sang phiên sau (event CARRY_OVER). */
export function countSessions(parentOrderId: string, events: OrderEvent[]): number {
  return (
    1 +
    events.filter(
      (event) => event.parent_order_id === parentOrderId && event.action === 'DECISION' && event.new_value?.startsWith('CARRY_OVER:'),
    ).length
  )
}

export interface HistoryRow {
  order: ParentOrder
  /** Ngày bắt đầu chạy (YYYY-MM-DD). */
  firstDate: string
  /** Ngày kết thúc; lệnh còn chạy là hôm nay. */
  date: string
  filledQty: number
  avgPrice: number | null
  vsArrivalPct: number | null
  arrivalFavorable: boolean | null
  sessions: number
  templateName: string | null
  isLive: boolean
}

export function buildHistoryRows(data: HistoryData): HistoryRow[] {
  return data.orders.filter(isHistoryOrder).map((order) => {
    const id = order.parent_order_id
    const quality = getExecQuality(
      order,
      data.children.filter((child) => child.parent_order_id === id),
      data.executions.filter((item) => item.parent_order_id === id),
      data.snapshots[id] ?? null,
      null,
    )
    const isLive = !isTerminalStatus(order.status)
    return {
      order,
      firstDate: order.created_at.slice(0, 10),
      date: isLive ? data.trading_date : order.updated_at.slice(0, 10),
      filledQty: quality.filledQty,
      avgPrice: quality.avgPrice,
      vsArrivalPct: quality.vsArrivalPct,
      arrivalFavorable: quality.arrivalFavorable,
      sessions: countSessions(id, data.events),
      templateName: quality.templateName,
      isLive,
    }
  })
}

/** Lọc theo trạng thái cuối; RUNNING là lệnh nhiều phiên còn chạy. */
export type HistoryStatusFilter = typeof ALL | 'COMPLETED' | 'CANCELLED' | 'EXPIRED' | 'RUNNING'

export const HISTORY_STATUS_LABELS: Record<Exclude<HistoryStatusFilter, typeof ALL>, string> = {
  COMPLETED: PARENT_STATUS_STYLES.COMPLETED.label,
  CANCELLED: PARENT_STATUS_STYLES.CANCELLED.label,
  EXPIRED: PARENT_STATUS_STYLES.EXPIRED.label,
  RUNNING: 'Đang chạy nhiều phiên',
}

export interface HistoryFilters {
  range: DateRangeValue
  symbol: string
  strategy_type: string
  side: string
  status: HistoryStatusFilter
  account_no: string
}

export const DEFAULT_HISTORY_FILTERS: HistoryFilters = {
  range: defaultDateRange('FIVE_SESSIONS'),
  symbol: ALL,
  strategy_type: ALL,
  side: ALL,
  status: ALL,
  account_no: ALL,
}

/** Lệnh nhiều phiên thuộc khoảng nếu có ít nhất một phiên chạy nằm trong khoảng: [ngày bắt đầu, ngày kết thúc] giao với khoảng. */
function overlaps(row: HistoryRow, range: DateRange) {
  return row.firstDate <= range.to && row.date >= range.from
}

export function filterHistoryRows(rows: HistoryRow[], filters: HistoryFilters, tradingDate: string): HistoryRow[] {
  const range = resolveDateRange(filters.range, tradingDate)
  const matches = (selected: string, value: string) => selected === ALL || selected === value
  return rows.filter(
    (row) =>
      overlaps(row, range) &&
      matches(filters.symbol, row.order.symbol) &&
      matches(filters.strategy_type, row.order.strategy_type) &&
      matches(filters.side, row.order.side) &&
      matches(filters.account_no, row.order.account_no) &&
      (filters.status === ALL || (filters.status === 'RUNNING' ? row.isLive : row.order.status === filters.status)),
  )
}

export type HistorySortKey =
  | 'date'
  | 'parent_order_id'
  | 'symbol'
  | 'side'
  | 'strategy_type'
  | 'template'
  | 'total_qty'
  | 'filledQty'
  | 'avgPrice'
  | 'vsArrivalPct'
  | 'status'
  | 'sessions'

export interface HistoryColumn {
  key: HistorySortKey
  label: string
  numeric?: boolean
}

export const HISTORY_COLUMNS: ReadonlyArray<HistoryColumn> = [
  { key: 'date', label: 'Ngày' },
  { key: 'parent_order_id', label: 'Mã lệnh' },
  { key: 'symbol', label: 'Mã CK' },
  { key: 'side', label: 'Chiều' },
  { key: 'strategy_type', label: 'Chiến lược' },
  { key: 'template', label: 'Mẫu' },
  { key: 'total_qty', label: 'KL đặt', numeric: true },
  { key: 'filledQty', label: 'KL khớp', numeric: true },
  { key: 'avgPrice', label: 'Giá BQ', numeric: true },
  { key: 'vsArrivalPct', label: 'So arrival', numeric: true },
  { key: 'status', label: 'Trạng thái cuối' },
  { key: 'sessions', label: 'Số phiên', numeric: true },
]

function sortValue(row: HistoryRow, key: HistorySortKey): string | number | null {
  switch (key) {
    case 'date':
      return `${row.date}${row.order.updated_at}`
    case 'parent_order_id':
    case 'symbol':
    case 'side':
    case 'total_qty':
      return row.order[key]
    case 'strategy_type':
      return STRATEGIES[row.order.strategy_type].label
    case 'template':
      return row.templateName
    case 'status':
      return PARENT_STATUS_STYLES[row.order.status].label
    default:
      return row[key]
  }
}

/** Ô không có số liệu luôn nằm cuối. Bằng nhau thì theo mã lệnh để thứ tự ổn định. */
export function sortHistoryRows(rows: HistoryRow[], key: HistorySortKey, direction: SortDirection): HistoryRow[] {
  const sign = direction === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const left = sortValue(a, key)
    const right = sortValue(b, key)
    if (left === null && right === null) return a.order.parent_order_id.localeCompare(b.order.parent_order_id)
    if (left === null) return 1
    if (right === null) return -1
    const order = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right))
    return order * sign || a.order.parent_order_id.localeCompare(b.order.parent_order_id)
  })
}

export interface Page<T> {
  rows: T[]
  /** Từ 1. */
  page: number
  pageCount: number
  total: number
  /** Số dòng mỗi trang. */
  size: number
}

/** Một trang dữ liệu. Trang ngoài khoảng thì kẹp về trang gần nhất. */
export function paginate<T>(rows: T[], page: number, size = HISTORY_PAGE_SIZE): Page<T> {
  const pageCount = Math.max(1, Math.ceil(rows.length / size))
  const current = Math.min(Math.max(1, page), pageCount)
  return { rows: rows.slice((current - 1) * size, current * size), page: current, pageCount, total: rows.length, size }
}

export interface HistoryTotals {
  count: number
  filledQty: number
  /** Số lệnh hoàn tất / số lệnh đã kết thúc (0..1). null khi chưa có lệnh nào kết thúc. */
  completionRate: number | null
}

/** Dòng tổng theo bộ lọc (mọi trang, không chỉ trang đang xem). */
export function getHistoryTotals(rows: HistoryRow[]): HistoryTotals {
  const finished = rows.filter((row) => !row.isLive)
  return {
    count: rows.length,
    filledQty: rows.reduce((sum, row) => sum + row.filledQty, 0),
    completionRate: finished.length === 0 ? null : finished.filter((row) => row.order.status === 'COMPLETED').length / finished.length,
  }
}

const STATUS_LABEL = (status: ParentOrderStatus) => PARENT_STATUS_STYLES[status].label

function toCell(row: HistoryRow, key: HistorySortKey): CsvCell {
  switch (key) {
    case 'date':
      return row.date
    case 'parent_order_id':
    case 'symbol':
      return row.order[key]
    case 'side':
      return SIDE_LABELS[row.order.side]
    case 'strategy_type':
      return STRATEGIES[row.order.strategy_type].label
    case 'template':
      return row.templateName
    case 'total_qty':
      return row.order.total_qty
    case 'filledQty':
    case 'sessions':
      return row[key]
    case 'avgPrice':
      return toCsvNumber(row.avgPrice)
    case 'vsArrivalPct':
      return toCsvNumber(row.vsArrivalPct)
    case 'status':
      return row.isLive ? `${STATUS_LABEL(row.order.status)} (đang chạy)` : STATUS_LABEL(row.order.status)
  }
}

const CSV_LABELS: Partial<Record<HistorySortKey, string>> = { vsArrivalPct: 'So arrival (%)', date: 'Ngày (YYYY-MM-DD)' }

/** CSV đúng các dòng đã lọc, đã sắp xếp (mọi trang), kèm tài khoản để đối chiếu. */
export function buildHistoryCsv(rows: HistoryRow[]): string {
  return toCsv(
    [...HISTORY_COLUMNS.map((column) => CSV_LABELS[column.key] ?? column.label), 'Tài khoản'],
    rows.map((row) => [...HISTORY_COLUMNS.map((column) => toCell(row, column.key)), row.order.account_no]),
  )
}

/** "lich-su-lenh-2026-11-10_2026-11-16.csv" */
export function getHistoryFilename(range: DateRange): string {
  return `lich-su-lenh-${range.from}_${range.to}.csv`
}

const rateFormatter = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** 0.6667 → "66,7%"; null → "—". */
export function formatCompletionRate(rate: number | null): string {
  return rate === null ? '—' : `${rateFormatter.format(rate * 100)}%`
}

/** Bấm tiêu đề đang sắp xếp thì đảo chiều, cột khác thì sắp tăng dần. */
export function nextSort<K>(current: { key: K; direction: SortDirection }, key: K): { key: K; direction: SortDirection } {
  return current.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' }
}
