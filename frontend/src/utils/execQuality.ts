import { getTemplate } from '@/config/strategyTemplates'
import { STRATEGIES } from '@/config/strategies'
import { formatPercent } from '@/lib/format'
import { getEntryExecutions } from '@/pages/OrderDetail/orderMetrics'
import type {
  ChildOrder,
  Execution,
  ExecutionReportData,
  MarketSnapshot,
  MarketTrade,
  MarketWindowStats,
  ParentOrder,
  Side,
  StrategyType,
} from '@/types'
import { isTerminalStatus } from './orderActions'

// Chỉ số hiệu quả thực hiện lệnh. Toàn bộ là hàm thuần: không gọi API, không đọc store.
// Giá là số nguyên đồng; kết quả chia (giá BQ, VWAP, %) giữ nguyên phần lẻ, chỉ làm tròn khi hiển thị.
// Thiếu số liệu (chưa khớp, chưa có arrival, thị trường chưa khớp) thì trả null, không chia cho 0.

const percentFormatter = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const integerFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })

/** Ký hiệu hiển thị khi không tính được. */
export const NO_VALUE = '—'

// ===== Từng lệnh =====

/** Giá BQ = Σ(giá × KL khớp) / ΣKL khớp. Chưa khớp thì null. */
export function getAvgFillPrice(executions: Pick<Execution, 'price' | 'qty'>[]): number | null {
  const qty = executions.reduce((sum, fill) => sum + fill.qty, 0)
  if (qty <= 0) return null
  // Cộng tổng tiền trên số nguyên rồi mới chia một lần, không cộng dồn sai số.
  const notional = executions.reduce((sum, fill) => sum + fill.price * fill.qty, 0)
  return notional / qty
}

export interface MarketWindow {
  from: string
  to: string
}

/**
 * Khoảng tính VWAP và tỷ lệ tham gia: [lúc kích hoạt, lúc hoàn tất hoặc hiện tại].
 * Lúc kích hoạt là lúc chụp arrival. Lệnh đã kết thúc lấy `updated_at` (lúc chuyển sang trạng thái cuối).
 * Không có arrival thì không xác định được khoảng, trả null.
 */
export function getMarketWindow(order: ParentOrder, snapshot: MarketSnapshot | null, now: string): MarketWindow | null {
  if (!snapshot) return null
  const to = isTerminalStatus(order.status) ? order.updated_at : now
  return { from: snapshot.arrival_timestamp, to: to < snapshot.arrival_timestamp ? snapshot.arrival_timestamp : to }
}

/** Tổng KL và giá trị khớp của các tick trong khoảng [from, to]. Tick ngoài khoảng bị bỏ. */
export function summarizeTicks(ticks: Pick<MarketTrade, 'time' | 'price' | 'qty'>[], from: string, to: string): MarketWindowStats {
  let volume = 0
  let value = 0
  for (const tick of ticks) {
    if (tick.time < from || tick.time > to) continue
    volume += tick.qty
    value += tick.price * tick.qty
  }
  return { volume, value }
}

/** VWAP thị trường = Σ(giá × KL) / ΣKL của tick trong khoảng. Thị trường chưa khớp thì null. */
export function getMarketVwap(stats: MarketWindowStats | null): number | null {
  if (!stats || stats.volume <= 0) return null
  return stats.value / stats.volume
}

/** Chênh lệch (%) = (giá BQ − mốc) / mốc × 100. Thiếu một trong hai thì null. */
export function getDiffPct(avgPrice: number | null, reference: number | null): number | null {
  if (avgPrice === null || reference === null || reference <= 0) return null
  return ((avgPrice - reference) / reference) * 100
}

/** Có lợi: MUA có chênh lệch âm (mua rẻ hơn mốc), BÁN có chênh lệch dương (bán đắt hơn mốc). Bằng 0 thì null. */
export function isFavorable(side: Side, diffPct: number | null): boolean | null {
  if (diffPct === null || diffPct === 0) return null
  return side === 'BUY' ? diffPct < 0 : diffPct > 0
}

/** Điểm cơ bản có lợi = chênh lệch (%) × 100, đổi dấu theo chiều để dương luôn là có lợi. */
export function toFavorableBps(side: Side, diffPct: number | null): number | null {
  if (diffPct === null) return null
  const bps = diffPct * 100
  return side === 'BUY' ? -bps : bps
}

/**
 * Tỷ lệ tham gia = KL khớp của lệnh / KL khớp toàn thị trường của mã trong cùng khoảng (0..1).
 * KL thị trường đã gồm lần khớp của lệnh, nên về lý thuyết không vượt 1; vẫn chặn trần phòng dữ liệu lệch.
 */
export function getParticipation(ownQty: number, marketVolume: number | null): number | null {
  if (marketVolume === null || marketVolume <= 0 || ownQty <= 0) return null
  return Math.min(ownQty / marketVolume, 1)
}

export interface ExecQualityRow {
  order: ParentOrder
  /** KL khớp của lệnh vào (lệnh thoát Bracket không tính). */
  filledQty: number
  avgPrice: number | null
  arrivalPrice: number | null
  vwap: number | null
  vsArrivalPct: number | null
  vsVwapPct: number | null
  arrivalBps: number | null
  vwapBps: number | null
  arrivalFavorable: boolean | null
  vwapFavorable: boolean | null
  /** 0..1 */
  participation: number | null
  marketVolume: number | null
  /** Lúc lệnh kết thúc; lệnh chưa kết thúc là null. */
  completedAt: string | null
  /** Tên mẫu chiến lược đã dùng khi đặt lệnh; null nếu đặt tay. */
  templateName: string | null
}

export function getExecQuality(
  order: ParentOrder,
  children: ChildOrder[],
  executions: Execution[],
  snapshot: MarketSnapshot | null,
  market: MarketWindowStats | null,
): ExecQualityRow {
  const fills = getEntryExecutions(order, children, executions)
  const filledQty = fills.reduce((sum, fill) => sum + fill.qty, 0)
  const avgPrice = getAvgFillPrice(fills)
  const arrivalPrice = snapshot?.arrival_price ?? null
  const vwap = getMarketVwap(market)
  const vsArrivalPct = getDiffPct(avgPrice, arrivalPrice)
  const vsVwapPct = getDiffPct(avgPrice, vwap)
  return {
    order,
    filledQty,
    avgPrice,
    arrivalPrice,
    vwap,
    vsArrivalPct,
    vsVwapPct,
    arrivalBps: toFavorableBps(order.side, vsArrivalPct),
    vwapBps: toFavorableBps(order.side, vsVwapPct),
    arrivalFavorable: isFavorable(order.side, vsArrivalPct),
    vwapFavorable: isFavorable(order.side, vsVwapPct),
    participation: getParticipation(filledQty, market?.volume ?? null),
    marketVolume: market?.volume ?? null,
    completedAt: isTerminalStatus(order.status) ? order.updated_at : null,
    templateName: getTemplate(order.template_id)?.name ?? null,
  }
}

// ===== Cả báo cáo =====

/** n ngày giao dịch gần nhất tính tới `tradingDate` (gồm cả ngày đó), bỏ thứ Bảy và Chủ nhật. */
export function getSessionDates(tradingDate: string, count: number): string[] {
  const [year, month, day] = tradingDate.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const dates: string[] = []
  while (dates.length < count) {
    if (date.getDay() !== 0 && date.getDay() !== 6) {
      dates.push(
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      )
    }
    date.setDate(date.getDate() - 1)
  }
  return dates
}

export type ReportPeriod = 'TODAY' | 'FIVE_SESSIONS'
export type ReportStatusFilter = 'COMPLETED' | 'COMPLETED_AND_LIVE'

export const REPORT_PERIOD_LABELS: Record<ReportPeriod, string> = { TODAY: 'Hôm nay', FIVE_SESSIONS: '5 phiên' }
export const REPORT_STATUS_LABELS: Record<ReportStatusFilter, string> = {
  COMPLETED: 'Đã hoàn tất',
  COMPLETED_AND_LIVE: 'Gồm cả đang chạy',
}

/** Giá trị "tất cả" của ô chọn, cùng quy ước với Sổ lệnh. */
export const ALL = 'ALL'

export interface ReportFilters {
  period: ReportPeriod
  status: ReportStatusFilter
  strategy_type: string
  side: string
  symbol: string
  account_no: string
}

export const DEFAULT_REPORT_FILTERS: ReportFilters = {
  period: 'FIVE_SESSIONS',
  status: 'COMPLETED',
  strategy_type: ALL,
  side: ALL,
  symbol: ALL,
  account_no: ALL,
}

const isLive = (order: ParentOrder) => order.status !== 'DRAFT' && !isTerminalStatus(order.status)

/**
 * Lọc dòng báo cáo. Lệnh đã hoàn tất tính theo ngày hoàn tất; lệnh đang chạy (khi chọn "gồm cả đang chạy")
 * luôn thuộc khoảng thời gian vì vẫn đang khớp ở phiên hiện tại.
 */
export function filterReportRows(rows: ExecQualityRow[], filters: ReportFilters, tradingDate: string): ExecQualityRow[] {
  const dates = new Set(getSessionDates(tradingDate, filters.period === 'TODAY' ? 1 : 5))
  const matches = (selected: string, value: string) => selected === ALL || selected === value
  return rows.filter(({ order, completedAt }) => {
    const completed = order.status === 'COMPLETED' && completedAt !== null && dates.has(completedAt.slice(0, 10))
    const live = filters.status === 'COMPLETED_AND_LIVE' && isLive(order)
    return (
      (completed || live) &&
      matches(filters.strategy_type, order.strategy_type) &&
      matches(filters.side, order.side) &&
      matches(filters.symbol, order.symbol) &&
      matches(filters.account_no, order.account_no)
    )
  })
}

export type ReportSortKey =
  | 'parent_order_id'
  | 'symbol'
  | 'side'
  | 'strategy_type'
  | 'avgPrice'
  | 'arrivalPrice'
  | 'vwap'
  | 'vsArrivalPct'
  | 'vsVwapPct'
  | 'participation'

export type SortDirection = 'asc' | 'desc'

function sortValue(row: ExecQualityRow, key: ReportSortKey): string | number | null {
  switch (key) {
    case 'parent_order_id':
    case 'symbol':
    case 'side':
      return row.order[key]
    case 'strategy_type':
      return STRATEGIES[row.order.strategy_type].label
    default:
      return row[key]
  }
}

/** Sắp xếp theo một cột. Ô không có số liệu luôn nằm cuối, dù sắp tăng hay giảm. */
export function sortReportRows(rows: ExecQualityRow[], key: ReportSortKey, direction: SortDirection): ExecQualityRow[] {
  const sign = direction === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const left = sortValue(a, key)
    const right = sortValue(b, key)
    if (left === null && right === null) return 0
    if (left === null) return 1
    if (right === null) return -1
    const order = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right))
    return order * sign || a.order.parent_order_id.localeCompare(b.order.parent_order_id)
  })
}

export interface ReportKpis {
  completed: number
  totalFilled: number
  /** Số lệnh có lợi so với arrival. */
  betterThanArrival: number
  /** Số lệnh tính được chênh lệch so với arrival (mẫu số của "x / y"). */
  measuredVsArrival: number
  /** Trung bình cộng tỷ lệ tham gia (0..1) của các lệnh có số liệu; không có thì null. */
  avgParticipation: number | null
}

export function getReportKpis(rows: ExecQualityRow[]): ReportKpis {
  const measured = rows.filter((row) => row.vsArrivalPct !== null)
  const participations = rows.map((row) => row.participation).filter((value): value is number => value !== null)
  return {
    completed: rows.filter((row) => row.order.status === 'COMPLETED').length,
    totalFilled: rows.reduce((sum, row) => sum + row.filledQty, 0),
    betterThanArrival: measured.filter((row) => row.arrivalFavorable === true).length,
    measuredVsArrival: measured.length,
    avgParticipation:
      participations.length > 0 ? participations.reduce((sum, value) => sum + value, 0) / participations.length : null,
  }
}

export interface StrategyBps {
  strategy_type: StrategyType
  label: string
  /** bps có lợi so với arrival, bình quân gia quyền theo KL khớp. */
  bps: number
  orders: number
}

/** bps có lợi theo chiến lược, chỉ tính lệnh có chênh lệch so với arrival. Sắp xếp từ có lợi nhất. */
export function getStrategyBps(rows: ExecQualityRow[]): StrategyBps[] {
  const groups = new Map<StrategyType, { weighted: number; qty: number; orders: number }>()
  for (const row of rows) {
    if (row.arrivalBps === null || row.filledQty <= 0) continue
    const group = groups.get(row.order.strategy_type) ?? { weighted: 0, qty: 0, orders: 0 }
    group.weighted += row.arrivalBps * row.filledQty
    group.qty += row.filledQty
    group.orders += 1
    groups.set(row.order.strategy_type, group)
  }
  return [...groups]
    .map(([strategy_type, group]) => ({
      strategy_type,
      label: STRATEGIES[strategy_type].label,
      bps: group.weighted / group.qty,
      orders: group.orders,
    }))
    .sort((a, b) => b.bps - a.bps || a.label.localeCompare(b.label))
}

/** Một câu nhận xét sinh theo quy tắc từ số đã tính. Không thêm số nào ngoài `stats`. */
export function describeStrategyBps(stats: StrategyBps[]): string {
  if (stats.length === 0) return 'Chưa đủ dữ liệu để so sánh các chiến lược.'
  const describe = (item: StrategyBps) => `${formatFavorableBps(item.bps)} (${item.orders} lệnh)`
  if (stats.length === 1) {
    const [only] = stats
    return `Chỉ có ${only.label}: trung bình ${describe(only)} so với arrival.`
  }
  const best = stats[0]
  const worst = stats[stats.length - 1]
  if (Math.round(worst.bps) >= 0) {
    return `Mọi chiến lược đều không bất lợi so với arrival. Tốt nhất ${best.label}: ${describe(best)}; thấp nhất ${worst.label}: ${describe(worst)}.`
  }
  if (Math.round(best.bps) <= 0) {
    return `Mọi chiến lược đều bất lợi so với arrival. Kém nhất ${worst.label}: ${describe(worst)}; đỡ nhất ${best.label}: ${describe(best)}.`
  }
  return `${worst.label} kém nhất: trung bình ${describe(worst)} so với arrival. Tốt nhất là ${best.label}: ${describe(best)}.`
}

// ===== Hiển thị =====

/** −0,1297 → "-0,13%", 0,34 → "+0,34%". null → "—". */
export function formatDiffPct(value: number | null): string {
  return value === null ? NO_VALUE : formatPercent(value)
}

/** 12,97 → "+13 bps", −16,26 → "-16 bps". null → "—". */
export function formatFavorableBps(value: number | null): string {
  if (value === null) return NO_VALUE
  const rounded = Math.round(value)
  const text = `${integerFormatter.format(rounded === 0 ? 0 : rounded)} bps`
  return rounded > 0 ? `+${text}` : text
}

/** 0,0423 → "4,2%". null → "—". */
export function formatParticipation(value: number | null): string {
  return value === null ? NO_VALUE : `${percentFormatter.format(value * 100)}%`
}

/** Giá đã tính (có thể lẻ) → số nguyên đồng để hiển thị. null → "—". */
export function formatQualityPrice(value: number | null): string {
  return value === null ? NO_VALUE : integerFormatter.format(Math.round(value))
}

/** Lớp màu theo có lợi / bất lợi. null (không tính được, hoặc bằng mốc) thì không tô màu. */
export function favorableClass(favorable: boolean | null): string {
  if (favorable === null) return ''
  return favorable ? 'text-price-up' : 'text-price-down'
}

export interface ReportColumn {
  key: ReportSortKey
  label: string
  /** Cột số: căn phải, font mono. */
  numeric: boolean
}

/** Cột của bảng báo cáo, theo đúng thứ tự hiển thị. File CSV dùng cùng danh sách này. */
export const REPORT_COLUMNS: ReadonlyArray<ReportColumn> = [
  { key: 'parent_order_id', label: 'Mã lệnh', numeric: false },
  { key: 'symbol', label: 'Mã CK', numeric: false },
  { key: 'side', label: 'Chiều', numeric: false },
  { key: 'strategy_type', label: 'Chiến lược', numeric: false },
  { key: 'avgPrice', label: 'Giá BQ', numeric: true },
  { key: 'arrivalPrice', label: 'Arrival', numeric: true },
  { key: 'vwap', label: 'VWAP', numeric: true },
  { key: 'vsArrivalPct', label: 'So arrival', numeric: true },
  { key: 'vsVwapPct', label: 'So VWAP', numeric: true },
  { key: 'participation', label: 'Tham gia', numeric: true },
]

/** Một dòng báo cáo cho mỗi lệnh trong dữ liệu (đã lọc theo quyền xem ở API). */
export function buildReportRows(
  data: Pick<ExecutionReportData, 'orders' | 'children' | 'executions' | 'snapshots' | 'market'>,
): ExecQualityRow[] {
  return data.orders.map((order) => {
    const id = order.parent_order_id
    return getExecQuality(
      order,
      data.children.filter((child) => child.parent_order_id === id),
      data.executions.filter((execution) => execution.parent_order_id === id),
      data.snapshots[id] ?? null,
      data.market[id] ?? null,
    )
  })
}
