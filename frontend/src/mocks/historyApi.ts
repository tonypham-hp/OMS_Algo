// API giả lập của màn Lịch sử và đối soát. Tách khỏi handlers để test phân quyền gọi thẳng được.
import { ROLE_PERMISSIONS } from '@/config/permissions'
import type { DemoUser, HistoryData, ReconciliationData } from '@/types'
import { maskAuditEvents } from '@/utils/audit'
import type { DateRange } from '@/utils/dateRange'
import { getSessionDates } from '@/utils/execQuality'
import { reconcile, validateReconStep, type ReconStep } from '@/utils/reconcile'
import { canSeeOrder } from './access'
import { EngineError, type OrderEngine } from './engine'
import { reconInputFromEngine } from './reconSource'

/** Mọi lệnh người dùng được xem, kèm toàn bộ event (không cắt như Trung tâm lệnh). Khách hàng không thấy user_id người khác. */
export function buildHistory(engine: OrderEngine, user: DemoUser, tradingDate: string): HistoryData {
  const orders = engine.listOrders().filter((order) => canSeeOrder(user, order))
  const visible = new Set(orders.map((order) => order.parent_order_id))
  const isVisible = (item: { parent_order_id: string }) => visible.has(item.parent_order_id)
  const snapshots: HistoryData['snapshots'] = {}
  for (const order of orders) {
    const snapshot = engine.getSnapshot(order.parent_order_id)
    if (snapshot) snapshots[order.parent_order_id] = snapshot
  }
  return {
    trading_date: tradingDate,
    orders,
    children: engine.listChildren().filter(isVisible),
    executions: engine.listExecutions().filter(isVisible),
    snapshots,
    events: maskAuditEvents(engine.listEvents().filter(isVisible), user),
  }
}

export const canReconcile = (user: Pick<DemoUser, 'role'>) => ROLE_PERMISSIONS[user.role].includes('reconciliation')
export const canResolveRecon = (user: Pick<DemoUser, 'role'>) => ROLE_PERMISSIONS[user.role].includes('reconcile_resolve')

const isDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)

/** Khoảng ngày từ query/body. Thiếu hoặc sai thì dùng 5 phiên tới hôm nay. */
export function parseRange(from: unknown, to: unknown, tradingDate: string): DateRange {
  if (isDate(from) && isDate(to)) return from <= to ? { from, to } : { from: to, to: from }
  const dates = getSessionDates(tradingDate, 5)
  return { from: dates[dates.length - 1], to: dates[0] }
}

export interface ReconDecisionBody {
  row_id: string
  step: ReconStep
  note?: string
  from?: string
  to?: string
}

/**
 * Đối soát trên engine. `now` là đồng hồ giả lập. Lần chạy gần nhất giữ trong bộ nhớ (backend thật lưu ở bảng riêng).
 */
export function createReconApi(engine: OrderEngine, now: () => string, today: () => string) {
  let lastRun: { at: string; by: string } | null = null

  function requireReconcile(user: DemoUser) {
    if (!canReconcile(user)) throw new EngineError('Không có quyền xem đối soát', 403)
  }

  function compute(user: DemoUser, range: DateRange): ReconciliationData {
    const result = reconcile(reconInputFromEngine(engine, range, now(), (order) => canSeeOrder(user, order)))
    return { ...result, last_run_at: lastRun?.at ?? null, last_run_by: lastRun?.by ?? null }
  }

  return {
    get(user: DemoUser, range: DateRange): ReconciliationData {
      requireReconcile(user)
      return compute(user, range)
    },

    /**
     * "Đối soát ngay": tra Core cho mọi lệnh con UNKNOWN (kết cục theo Core), rồi so lại toàn bộ.
     * Lệnh con UNKNOWN là trạng thái hiện tại nên được tra dù tạo từ phiên nào, cùng quy tắc với reconcile.
     */
    run(user: DemoUser, range: DateRange): ReconciliationData {
      requireReconcile(user)
      const visible = new Set(engine.listOrders().filter((order) => canSeeOrder(user, order)).map((order) => order.parent_order_id))
      const unknown = engine
        .listChildren()
        .filter((child) => child.status === 'UNKNOWN' && visible.has(child.parent_order_id))
        .map((child) => child.child_order_id)
      for (const childOrderId of unknown) engine.reconcileChildNow(childOrderId, user.username)
      lastRun = { at: now(), by: user.username }
      return compute(user, range)
    },

    /** Đánh dấu đã xử lý, duyệt, từ chối: chỉ vận hành, theo luật maker-checker. */
    decide(user: DemoUser, body: ReconDecisionBody): ReconciliationData {
      if (!canResolveRecon(user)) throw new EngineError('Chỉ vận hành được xử lý chênh lệch', 403)
      const range = parseRange(body.from, body.to, today())
      const row = compute(user, range).rows.find((item) => item.id === body.row_id)
      const note = (body.note ?? '').trim()
      const error = validateReconStep(row, body.step, user.username, note)
      if (error) throw new EngineError(error, row ? 422 : 404)
      engine.logReconDecision({
        parent_order_id: row!.parent_order_id,
        child_order_id: row!.child_order_id,
        row_id: row!.id,
        step: body.step,
        note,
        user_id: user.username,
      })
      return compute(user, range)
    },

    /** Số chênh lệch đang mở trong 5 phiên, cho liên kết "Xem đối soát" ở Trung tâm lệnh. */
    openCount(user: DemoUser): number {
      if (!canReconcile(user)) return 0
      return compute(user, parseRange(undefined, undefined, today())).rows.filter((item) => item.status !== 'RESOLVED').length
    },

    reset() {
      lastRun = null
    },
  }
}

export type ReconApi = ReturnType<typeof createReconApi>

