// Đối soát OMS với Core: hàm thuần, chỉ đọc dữ liệu truyền vào. Mock API và test dùng chung.
import { CHILD_STATUS_STYLES } from '@/config/orderStatus'
import { AUTO_RESOLVED_TYPES, RECON_TYPES, UNKNOWN_OPEN_AFTER_SECONDS } from '@/config/reconcile'
import { formatNumber } from '@/lib/format'
import { getEntryExecutions } from '@/pages/OrderDetail/orderMetrics'
import type {
  ChildOrder,
  ChildOrderStatus,
  CoreLedgerEntry,
  CoreOrderStatus,
  Execution,
  OrderEvent,
  ParentOrder,
  ReconResult,
  ReconRow,
  ReconRowStatus,
  ReconType,
} from '@/types'
import { isInRange, type DateRange } from './dateRange'

export interface ReconInput extends DateRange {
  orders: ParentOrder[]
  children: ChildOrder[]
  executions: Execution[]
  events: OrderEvent[]
  coreLedger: CoreLedgerEntry[]
  /** Thời điểm đối soát, `YYYY-MM-DDTHH:mm:ss` theo đồng hồ giả lập. */
  now: string
  unknownAfterSeconds?: number
}

/** Bước xử lý một dòng chênh lệch, ghi ở new_value của event DECISION `RECON:<mã dòng>`. */
export type ReconStep = 'RESOLVE_REQUESTED' | 'RESOLVED' | 'RESOLVE_REJECTED'

export const RECON_EVENT_PREFIX = 'RECON:'

const n = formatNumber
const childLabel = (status: ChildOrderStatus | CoreOrderStatus) => CHILD_STATUS_STYLES[status].label

/** Giây giữa hai thời điểm `YYYY-MM-DDTHH:mm:ss` (cùng múi giờ). */
function secondsBetween(from: string, to: string) {
  return (new Date(to).getTime() - new Date(from).getTime()) / 1000
}

function addSeconds(iso: string, seconds: number) {
  const date = new Date(new Date(iso).getTime() + seconds * 1000)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

const TERMINAL_CHILD: ReadonlySet<ChildOrderStatus> = new Set(['FILLED', 'CANCELLED', 'REJECTED', 'EXPIRED'])
const LIVE_CORE: ReadonlySet<CoreOrderStatus> = new Set(['ACKNOWLEDGED', 'PARTIAL_FILLED'])
/** OMS đang giữ lệnh trên sàn: Core phải có lệnh. */
const OMS_ON_CORE: ReadonlySet<ChildOrderStatus> = new Set(['ACKNOWLEDGED', 'PARTIAL_FILLED', 'FILLED'])

/** Trạng thái OMS và Core có được coi là khớp nhau không. Lệnh con OMS đang chờ hủy thì Core còn sống là bình thường. */
function isSameStatus(oms: ChildOrderStatus, core: CoreOrderStatus) {
  if (oms === core) return true
  return oms === 'CANCEL_PENDING' && LIVE_CORE.has(core)
}

type DraftRow = Omit<ReconRow, 'status' | 'note' | 'requested_by' | 'approved_by'> & { autoNote?: string }

function row(
  type: ReconType,
  key: string,
  fields: Omit<DraftRow, 'id' | 'type' | 'critical'>,
): DraftRow {
  return { id: `${type}:${key}`, type, critical: type === 'OVERFILL', ...fields }
}

/** Các chênh lệch của một lệnh con: trạng thái, KL khớp, UNKNOWN chưa đối soát. */
function compareChild(child: ChildOrder, entry: CoreLedgerEntry | undefined, events: OrderEvent[], input: ReconInput): DraftRow[] {
  const base = { parent_order_id: child.parent_order_id, child_order_id: child.child_order_id }
  if (child.status === 'UNKNOWN') {
    const since =
      events.filter((event) => event.new_value === 'UNKNOWN').at(-1)?.event_time ?? child.sent_at ?? child.created_at
    const threshold = input.unknownAfterSeconds ?? UNKNOWN_OPEN_AFTER_SECONDS
    if (secondsBetween(since, input.now) < threshold) return []
    return [
      row('UNKNOWN_OPEN', child.child_order_id, {
        ...base,
        detected_at: addSeconds(since, threshold),
        oms_value: `UNKNOWN từ ${since.slice(11)}`,
        core_value: 'Chưa đối soát',
      }),
    ]
  }
  // Đang gửi: chưa tới hạn chờ ACK, chưa so được.
  if (child.status === 'SENDING' || child.status === 'CREATED') return []

  const rows: DraftRow[] = []
  const detected = entry?.updated_at ?? child.sent_at ?? child.created_at
  if (!entry) {
    if (OMS_ON_CORE.has(child.status) || child.filled_qty > 0) {
      rows.push(
        row('STATUS_MISMATCH', child.child_order_id, {
          ...base,
          detected_at: detected,
          oms_value: childLabel(child.status),
          core_value: 'Không có lệnh',
        }),
      )
    }
    return rows
  }
  if (!isSameStatus(child.status, entry.status)) {
    rows.push(
      row('STATUS_MISMATCH', child.child_order_id, {
        ...base,
        detected_at: detected,
        oms_value: childLabel(child.status),
        core_value: childLabel(entry.status),
      }),
    )
  }
  if (entry.filled_qty !== child.filled_qty) {
    rows.push(
      row('QTY_MISMATCH', child.child_order_id, {
        ...base,
        detected_at: detected,
        oms_value: `Khớp ${n(child.filled_qty)} CP`,
        core_value: `Khớp ${n(entry.filled_qty)} CP`,
      }),
    )
  }
  return rows
}

/** Lệnh con từng UNKNOWN đã được đối soát: mỗi lần RECOVERY sau UNKNOWN là một dòng, kèm kết quả tra Core. */
function resolvedUnknownRows(child: ChildOrder, entry: CoreLedgerEntry | undefined, events: OrderEvent[], range: DateRange): DraftRow[] {
  const rows: DraftRow[] = []
  let unknownSince: string | null = null
  for (const event of events) {
    if (event.new_value === 'UNKNOWN') {
      unknownSince = event.event_time
      continue
    }
    if (unknownSince === null || event.action !== 'RECOVERY' || event.old_value !== 'UNKNOWN') continue
    if (isInRange(event.event_time, range)) {
      const kept = event.reason_code === 'RECONCILED_KEPT'
      const result = kept ? 'Core có lệnh' : entry ? 'Core có lệnh, đã hủy' : 'Core không có lệnh'
      rows.push(
        row('UNKNOWN_RESOLVED', `${child.child_order_id}:${event.event_id}`, {
          parent_order_id: child.parent_order_id,
          child_order_id: child.child_order_id,
          detected_at: event.event_time,
          oms_value: `UNKNOWN → ${childLabel(event.new_value as ChildOrderStatus)}`,
          core_value: result,
          autoNote: `Đối soát xong: ${result}.`,
        }),
      )
    }
    unknownSince = null
  }
  return rows
}

/** Báo khớp trùng mà engine đã bỏ qua: event DECISION `DUPLICATE_FILL:<mã khớp>` → IGNORED. */
function duplicateRows(events: OrderEvent[], executions: Execution[], range: DateRange): DraftRow[] {
  return events
    .filter((event) => event.action === 'DECISION' && event.old_value?.startsWith('DUPLICATE_FILL:') && event.new_value === 'IGNORED')
    .filter((event) => isInRange(event.event_time, range))
    .map((event) => {
      const matchId = (event.old_value ?? '').slice('DUPLICATE_FILL:'.length)
      const recorded = executions.filter((item) => item.exchange_match_id === matchId).length
      return row('DUP_FILL_IGNORED', event.event_id, {
        parent_order_id: event.parent_order_id,
        child_order_id: event.child_order_id,
        detected_at: event.event_time,
        oms_value: `Ghi ${n(recorded)} lần khớp ${matchId}`,
        core_value: 'Báo khớp gửi lại, đã bỏ qua',
        autoNote: `Bỏ qua báo khớp trùng ${matchId}, khối lượng không đổi.`,
      })
    })
}

/** Kiểm tra trên lệnh cha: executed_qty bằng tổng Execution, và tổng khớp (OMS hay Core) không vượt KL đặt. */
function compareParent(order: ParentOrder, input: ReconInput, children: ChildOrder[], ledger: Map<string, CoreLedgerEntry>): DraftRow[] {
  const rows: DraftRow[] = []
  const fills = getEntryExecutions(order, children, input.executions.filter((item) => item.parent_order_id === order.parent_order_id))
  const sum = fills.reduce((total, fill) => total + fill.qty, 0)
  const base = { parent_order_id: order.parent_order_id, child_order_id: null, detected_at: order.updated_at }
  if (order.executed_qty !== sum) {
    rows.push(
      row('PARENT_SUM_MISMATCH', order.parent_order_id, {
        ...base,
        oms_value: `executed_qty ${n(order.executed_qty)} CP`,
        core_value: `Tổng khớp ${n(sum)} CP`,
      }),
    )
  }
  const coreSum = children
    .filter((child) => child.side === order.side)
    .reduce((total, child) => total + (ledger.get(child.child_order_id)?.filled_qty ?? 0), 0)
  const maxFilled = Math.max(order.executed_qty, sum, coreSum)
  if (maxFilled > order.total_qty) {
    rows.push(
      row('OVERFILL', order.parent_order_id, {
        ...base,
        oms_value: `Khớp ${n(Math.max(order.executed_qty, sum))}/${n(order.total_qty)} CP`,
        core_value: `Khớp ${n(coreSum)}/${n(order.total_qty)} CP`,
      }),
    )
  }
  return rows
}

interface Decision {
  step: ReconStep
  user_id: string
  note: string | null
}

/** Quyết định xử lý của từng dòng, theo thứ tự ghi. */
function collectDecisions(events: OrderEvent[]): Map<string, Decision[]> {
  const decisions = new Map<string, Decision[]>()
  for (const event of events) {
    if (event.action !== 'DECISION' || !event.old_value?.startsWith(RECON_EVENT_PREFIX)) continue
    const id = event.old_value.slice(RECON_EVENT_PREFIX.length)
    const list = decisions.get(id) ?? []
    list.push({ step: event.new_value as ReconStep, user_id: event.user_id, note: event.reason ?? null })
    decisions.set(id, list)
  }
  return decisions
}

/** Trạng thái hiện tại của một dòng từ chuỗi quyết định: Mở → Chờ duyệt → Đã xử lý, bị từ chối thì về Mở. */
function applyDecisions(draft: DraftRow, decisions: Decision[] = []): ReconRow {
  const { autoNote, ...fields } = draft
  if (AUTO_RESOLVED_TYPES.has(draft.type)) {
    return { ...fields, status: 'RESOLVED', note: autoNote ?? null, requested_by: 'SYSTEM', approved_by: 'SYSTEM' }
  }
  let status: ReconRowStatus = 'OPEN'
  let note: string | null = null
  let requestedBy: string | null = null
  let approvedBy: string | null = null
  for (const decision of decisions) {
    if (decision.step === 'RESOLVE_REQUESTED') {
      status = 'PENDING_APPROVAL'
      note = decision.note
      requestedBy = decision.user_id
      approvedBy = null
    } else if (decision.step === 'RESOLVED' && status === 'PENDING_APPROVAL') {
      status = 'RESOLVED'
      approvedBy = decision.user_id
    } else if (decision.step === 'RESOLVE_REJECTED' && status === 'PENDING_APPROVAL') {
      status = 'OPEN'
      note = `Bị từ chối bởi ${decision.user_id}${decision.note ? `: ${decision.note}` : ''}`
      requestedBy = null
    }
  }
  return { ...fields, status, note, requested_by: requestedBy, approved_by: approvedBy }
}

/**
 * So OMS với Core cho các lệnh con tạo trong khoảng [from, to], cộng kiểm tra trên lệnh cha.
 * Trả về số lệnh con đã so, số lệnh con khớp đúng và danh sách chênh lệch (mỗi dòng một loại).
 */
export function reconcile(input: ReconInput): ReconResult {
  const range: DateRange = { from: input.from, to: input.to }
  const ledger = new Map(input.coreLedger.map((entry) => [entry.child_order_id, entry]))
  const eventsByChild = new Map<string, OrderEvent[]>()
  for (const event of input.events) {
    if (!event.child_order_id) continue
    const list = eventsByChild.get(event.child_order_id) ?? []
    list.push(event)
    eventsByChild.set(event.child_order_id, list)
  }

  // Lệnh con tạo trong khoảng, cộng mọi lệnh con chưa kết thúc: chúng là trạng thái hiện tại dù tạo từ phiên nào.
  const checked = input.children.filter((child) => isInRange(child.created_at, range) || !TERMINAL_CHILD.has(child.status))
  const drafts: DraftRow[] = []
  let matched = 0
  for (const child of checked) {
    const childRows = compareChild(child, ledger.get(child.child_order_id), eventsByChild.get(child.child_order_id) ?? [], input)
    // Đang chờ ACK hay UNKNOWN chưa quá ngưỡng: chưa biết Core có lệnh không, nên chưa tính là khớp đúng.
    if (childRows.length === 0 && child.status !== 'SENDING' && child.status !== 'UNKNOWN') matched += 1
    drafts.push(...childRows)
  }
  // Dòng theo event (đã đối soát, khớp trùng) tính theo thời điểm xảy ra, nên lấy trên mọi lệnh con.
  for (const child of input.children) {
    drafts.push(...resolvedUnknownRows(child, ledger.get(child.child_order_id), eventsByChild.get(child.child_order_id) ?? [], range))
  }
  drafts.push(...duplicateRows(input.events, input.executions, range))

  const childrenByParent = new Map<string, ChildOrder[]>()
  for (const child of input.children) {
    const list = childrenByParent.get(child.parent_order_id) ?? []
    list.push(child)
    childrenByParent.set(child.parent_order_id, list)
  }
  const checkedParents = new Set(checked.map((child) => child.parent_order_id))
  for (const order of input.orders) {
    const touched = checkedParents.has(order.parent_order_id) || isInRange(order.created_at, range) || isInRange(order.updated_at, range)
    if (touched) drafts.push(...compareParent(order, input, childrenByParent.get(order.parent_order_id) ?? [], ledger))
  }

  const decisions = collectDecisions(input.events)
  const rows = drafts
    .map((draft) => applyDecisions(draft, decisions.get(draft.id)))
    .sort(
      (a, b) =>
        RECON_TYPES.indexOf(a.type) - RECON_TYPES.indexOf(b.type) ||
        b.detected_at.localeCompare(a.detected_at) ||
        a.id.localeCompare(b.id),
    )
  return { from: input.from, to: input.to, checked_children: checked.length, matched_children: matched, rows }
}

export interface ReconSummary {
  checked: number
  matched: number
  /** Mở hoặc chờ duyệt. */
  open: number
  resolved: number
  critical: number
}

export function getReconSummary(result: ReconResult): ReconSummary {
  return {
    checked: result.checked_children,
    matched: result.matched_children,
    open: result.rows.filter((item) => item.status !== 'RESOLVED').length,
    resolved: result.rows.filter((item) => item.status === 'RESOLVED').length,
    critical: result.rows.filter((item) => item.critical).length,
  }
}

/**
 * Kiểm tra một bước xử lý trước khi ghi (maker-checker như màn Cấu hình):
 * đánh dấu cần dòng đang Mở và ghi chú; duyệt hay từ chối cần dòng Chờ duyệt và người khác người đánh dấu.
 * Trả về câu lỗi, hoặc null nếu được.
 */
export function validateReconStep(row: ReconRow | undefined, step: ReconStep, userId: string, note: string): string | null {
  if (!row) return 'Không tìm thấy dòng chênh lệch trong khoảng đang xem'
  if (AUTO_RESOLVED_TYPES.has(row.type)) return 'Dòng này hệ thống đã tự xử lý'
  if (step === 'RESOLVE_REQUESTED') {
    if (row.status !== 'OPEN') return 'Chỉ đánh dấu được dòng đang mở'
    if (note.trim() === '') return 'Phải nhập ghi chú khi đánh dấu đã xử lý'
    return null
  }
  if (row.status !== 'PENDING_APPROVAL') return 'Dòng này không chờ duyệt'
  if (row.requested_by === userId) return 'Người đánh dấu không được tự duyệt, cần một người vận hành khác'
  if (step === 'RESOLVE_REJECTED' && note.trim() === '') return 'Phải nhập lý do từ chối'
  return null
}
