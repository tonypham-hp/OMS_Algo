import { MAX_ORDER_QTY, PRICE_BAND_PCT, QTY_LOT_SIZE } from '@/config/hose'
import { formatDateTime, formatNumber } from '@/lib/format'
import type { ChildOrder, EventReasonCode, OrderEvent, OrderReasonCode, ParentOrder, Role, StrategyType } from '@/types'
import { getTickSize } from '@/utils/hose'
import { buildExplainContext } from './context'
import { describeReject, REASONS } from './reasons'
import type {
  ChildExplanation,
  ExplainAction,
  ExplainCode,
  ExplainContext,
  ExplainExtra,
  ExplainMarket,
  Explanation,
} from './types'

const PAUSE_REASON_TO_CODE: Record<OrderReasonCode, ExplainCode> = {
  PRICE_OUT_OF_BAND: 'PRICE_OUT_OF_BAND',
  CHILD_REJECTED_REPEAT: 'CHILD_REJECTED',
  MARKET_DATA_STALE: 'STALE_MARKET_DATA',
  KILL_SWITCH: 'KILL_SWITCH',
}

/** Loại lệnh chờ điều kiện giá rồi mới sinh lệnh con. */
const CONDITIONAL: ReadonlySet<StrategyType> = new Set(['STOP', 'STOP_LIMIT', 'TAKE_PROFIT', 'TRAILING_STOP', 'OCO', 'HUNT'])

const lastOf = <T>(items: T[], predicate: (item: T) => boolean): T | undefined => items.filter(predicate).at(-1)

/** Trong hai loại event, loại nào xảy ra sau cùng. */
function isLatest(events: OrderEvent[], wanted: (event: OrderEvent) => boolean, other: (event: OrderEvent) => boolean) {
  const last = lastOf(events, (event) => wanted(event) || other(event))
  return last !== undefined && wanted(last)
}

function selectCode(order: ParentOrder, children: ChildOrder[], events: OrderEvent[], ctx: ExplainContext): ExplainCode {
  switch (order.status) {
    case 'COMPLETED':
      return 'COMPLETED'
    case 'EXPIRED':
      return ctx.expire_code === 'HUNT_NO_LEVEL' ? 'HUNT_NO_LEVEL' : 'EXPIRED'
    case 'CANCELLED':
    case 'CANCEL_PENDING':
      return 'CANCELLED'
    case 'PAUSED_USER':
      return 'PAUSED_USER'
    case 'PAUSED_SYSTEM': {
      if (order.reason_code) return PAUSE_REASON_TO_CODE[order.reason_code]
      const pause = lastOf(events, (event) => event.action === 'PAUSE' && event.child_order_id === null)
      const fromEvent = pause?.reason_code as OrderReasonCode | undefined
      if (fromEvent && fromEvent in PAUSE_REASON_TO_CODE) return PAUSE_REASON_TO_CODE[fromEvent]
      return ctx.unknown_child ? 'CHILD_UNKNOWN' : 'NOT_ENOUGH_DATA'
    }
    case 'ACTIVE':
    case 'PARTIALLY_EXECUTED': {
      if (ctx.unknown_child) return 'CHILD_UNKNOWN'
      const latestChild = children.toSorted((a, b) => a.cycle_no - b.cycle_no).at(-1)
      if (latestChild?.status === 'REJECTED') return 'CHILD_REJECTED'
      if (!ctx.can_modify) return 'SESSION_LOCKED'
      if (
        order.strategy_type === 'POV' &&
        isLatest(events, (event) => event.reason_code === 'POV_THROTTLED', (event) => event.action === 'CHILD_CREATE')
      ) {
        return 'POV_THROTTLED'
      }
      if (
        order.strategy_type === 'HUNT' &&
        isLatest(
          events,
          (event) => event.reason_code === 'HUNT_WAITING_LEVEL',
          (event) => (event.old_value ?? '').startsWith('HUNT_SWEEP'),
        )
      ) {
        return 'HUNT_NO_LEVEL'
      }
      const waitsCondition =
        (CONDITIONAL.has(order.strategy_type) && !ctx.is_triggered) ||
        (order.strategy_type === 'BRACKET' && ctx.conditions.length > 0 && !ctx.is_triggered && ctx.working_children === 0)
      if (waitsCondition) return 'CONDITION_WAITING'
      return 'RUNNING'
    }
    default:
      return 'NOT_ENOUGH_DATA'
  }
}

function relatedEventId(code: ExplainCode, order: ParentOrder, events: OrderEvent[], ctx: ExplainContext): string | null {
  const byReason = (reason: EventReasonCode) => lastOf(events, (event) => event.reason_code === reason)?.event_id
  const statusEvent = () =>
    lastOf(events, (event) => event.child_order_id === null && event.new_value === order.status)?.event_id
  switch (code) {
    case 'PRICE_OUT_OF_BAND':
      return byReason('PRICE_OUT_OF_BAND') ?? statusEvent() ?? null
    case 'STALE_MARKET_DATA':
      return byReason('MARKET_DATA_STALE') ?? statusEvent() ?? null
    case 'KILL_SWITCH':
      return byReason('KILL_SWITCH') ?? statusEvent() ?? null
    case 'CHILD_REJECTED':
      return ctx.last_reject?.event_id ?? statusEvent() ?? null
    case 'CHILD_UNKNOWN':
      return ctx.unknown_child?.event_id ?? null
    case 'POV_THROTTLED':
      return byReason('POV_THROTTLED') ?? null
    case 'HUNT_NO_LEVEL':
      return (order.status === 'EXPIRED' ? statusEvent() : byReason('HUNT_WAITING_LEVEL')) ?? null
    case 'SESSION_LOCKED':
    case 'RUNNING':
    case 'CONDITION_WAITING':
      return events.at(-1)?.event_id ?? null
    default:
      return statusEvent() ?? events.at(-1)?.event_id ?? null
  }
}

function firstSentence(text: string): string {
  // Dấu chấm phân cách hàng nghìn luôn đứng trước chữ số, nên chỉ cắt ở dấu chấm đứng trước khoảng trắng.
  const index = text.search(/\.(\s|$)/)
  return index === -1 ? text : text.slice(0, index + 1)
}

/**
 * Giải thích vì sao lệnh đang ở trạng thái hiện tại, bằng quy tắc trên dữ liệu có sẵn.
 * Không ném lỗi: dữ liệu thiếu thì câu nói "chưa đủ dữ liệu". Nút hành động lọc theo vai trò.
 */
export function explainOrder(
  order: ParentOrder,
  children: ChildOrder[],
  events: OrderEvent[],
  market: ExplainMarket,
  role: Role,
  extra: ExplainExtra = {},
): Explanation {
  const ownEvents = events.filter((event) => event.parent_order_id === order.parent_order_id)
  const ownChildren = children.filter((child) => child.parent_order_id === order.parent_order_id)
  const ctx = buildExplainContext(order, ownChildren, ownEvents, market, extra)
  const code = selectCode(order, ownChildren, ownEvents, ctx)
  ctx.related_event_id = relatedEventId(code, order, ownEvents, ctx)
  const reason = REASONS[code]
  const text = reason.template(ctx)

  const actions: ExplainAction[] = reason.actions
    .filter((def) => def.roles === undefined || def.roles.includes(role))
    // "Mở lại" chỉ hiện khi lệnh đang bị hệ thống dừng; ở trạng thái khác nút này không có nghĩa.
    .filter((def) => def.kind !== 'REOPEN' || order.status === 'PAUSED_SYSTEM')
    .map((def) => {
      const check = def.enabled?.(ctx) ?? true
      const action: ExplainAction = { kind: def.kind, label: def.label, enabled: check === true }
      if (check !== true) action.reason = check
      if (def.kind === 'REPRICE' && ctx.out_of_band) action.prices = { [ctx.out_of_band.field]: ctx.out_of_band.suggested }
      if (def.kind === 'RECONCILE' && ctx.unknown_child) action.child_order_id = ctx.unknown_child.child_order_id
      if (def.kind === 'RECONCILE' && !ctx.unknown_child) {
        action.enabled = false
        action.reason = 'Không có lệnh con chưa rõ trạng thái'
      }
      if (def.kind === 'SCROLL_LOG') {
        if (ctx.related_event_id) action.event_id = ctx.related_event_id
        else {
          action.enabled = false
          action.reason = 'Chưa có sự kiện nào'
        }
      }
      return action
    })

  return { code, title: reason.title, text, short: firstSentence(text), actions, sources: reason.sources(ctx), context: ctx }
}

/** Câu giải thích ngắn chỉ từ trạng thái và reason_code, khi chưa có lệnh con và nhật ký (Sổ lệnh, Trung tâm lệnh). */
export function explainOrderBrief(order: ParentOrder, market: ExplainMarket, role: Role, children: ChildOrder[] = [], events: OrderEvent[] = []) {
  return explainOrder(order, children, events, market, role).short
}

const n = formatNumber
const RULES = { lot_size: QTY_LOT_SIZE, max_order_qty: MAX_ORDER_QTY, band_pct: PRICE_BAND_PCT }

const EXPIRE_CHILD_TEXT: Partial<Record<EventReasonCode, string>> = {
  DAY_END: 'Hết hạn cùng lệnh cha khi hết ngày giao dịch.',
  VALID_TO_REACHED: 'Hết hạn cùng lệnh cha khi tới ngày hết hiệu lực.',
  WINDOW_END: 'Hết hạn khi hết khung giờ của lệnh cha.',
  HUNT_MAX_WAIT: 'Hết hạn khi lệnh cha hết thời gian chờ săn.',
  HUNT_NO_LEVEL: 'Hết hạn khi lệnh cha quét hết các mức trong giới hạn giá.',
}

/** Giải thích riêng cho một lệnh con, theo trạng thái và các event của chính lệnh con đó. */
export function explainChild(child: ChildOrder, events: OrderEvent[]): ChildExplanation {
  const own = events.filter((event) => event.child_order_id === child.child_order_id)
  const last = own.at(-1)
  const price = child.price === null ? `giá thị trường (${child.order_type})` : `giá ${n(child.price)}`
  const open = child.quantity - child.filled_qty
  const cycle = `Lệnh con chu kỳ ${n(child.cycle_no)}`
  switch (child.status) {
    case 'REJECTED': {
      const event = lastOf(own, (item) => item.action === 'REJECT')
      const detail = describeReject(
        {
          quantity: child.quantity,
          price: child.price,
          tick: child.price === null ? null : getTickSize(child.price),
          reject_code: event?.reject_code ?? null,
        },
        RULES,
      )
      return { code: 'CHILD_REJECTED', status: child.status, text: `${cycle} bị Core từ chối: ${detail}.` }
    }
    case 'UNKNOWN': {
      const sent = child.sent_at ? ` lúc ${formatDateTime(child.sent_at)}` : ''
      return {
        code: 'CHILD_UNKNOWN',
        status: child.status,
        text: `${cycle} đã gửi${sent} nhưng mất xác nhận (ACK) từ Core. Đang đối soát; chưa gửi lại ${n(open)} CP để không đặt trùng.`,
      }
    }
    case 'CANCELLED':
      if (last?.reason_code === 'RECONCILED_CANCELLED') {
        return { code: 'CHILD_STATE', status: child.status, text: `${cycle}: đối soát xong, Core không còn giữ lệnh nên đã hủy, giải phóng ${n(open)} CP để sinh lại.` }
      }
      return { code: 'CHILD_STATE', status: child.status, text: `${cycle} đã hủy, phần chưa khớp ${n(open)} CP không còn chờ trên Core.` }
    case 'EXPIRED':
      return {
        code: 'EXPIRED',
        status: child.status,
        text: `${cycle}: ${(last?.reason_code && EXPIRE_CHILD_TEXT[last.reason_code]) ?? 'hết hạn, chưa đủ dữ liệu để biết nguyên nhân.'} Đã khớp ${n(child.filled_qty)}/${n(child.quantity)} CP.`,
      }
    case 'FILLED':
      return { code: 'CHILD_STATE', status: child.status, text: `${cycle} đã khớp đủ ${n(child.quantity)} CP, đặt ở ${price}.` }
    case 'PARTIAL_FILLED':
      return { code: 'CHILD_STATE', status: child.status, text: `${cycle} đã khớp ${n(child.filled_qty)}/${n(child.quantity)} CP ở ${price}, đang chờ khớp ${n(open)} CP còn lại.` }
    case 'ACKNOWLEDGED': {
      const kept = last?.reason_code === 'RECONCILED_KEPT' ? ' Đối soát xong: Core đã nhận lệnh nên giữ nguyên, không gửi lại.' : ''
      return { code: 'CHILD_STATE', status: child.status, text: `${cycle} đã được Core nhận, đang chờ khớp ${n(open)} CP ở ${price}.${kept}` }
    }
    case 'SENDING':
      return { code: 'CHILD_STATE', status: child.status, text: `${cycle} đã gửi, đang chờ Core xác nhận.` }
    case 'CANCEL_PENDING':
      return { code: 'CHILD_STATE', status: child.status, text: `${cycle} đang chờ Core xác nhận hủy ${n(open)} CP.` }
    case 'CREATED':
      return { code: 'CHILD_STATE', status: child.status, text: `${cycle} vừa tạo, sẽ gửi Core ở nhịp kế tiếp.` }
  }
}
