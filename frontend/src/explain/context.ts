import { MAX_ORDER_QTY, PRICE_BAND_PCT, QTY_LOT_SIZE, SESSION_LABELS } from '@/config/hose'
import { PERSISTENCE_LABELS, SIDE_LABELS, STRATEGIES } from '@/config/strategies'
import { formatBps, formatDateTime } from '@/lib/format'
import type { ChildOrder, OrderEvent, ParentOrder, PriceFieldName, Side } from '@/types'
import { getExecQuality } from '@/utils/execQuality'
import { countTicks, getCeilingPrice, getFloorPrice, getTickSize, isModifyCancelAllowed } from '@/utils/hose'
import type { ConditionInfo, ExplainContext, ExplainExtra, ExplainMarket, PriceOutOfBand, RejectInfo } from './types'

const LIVE_CHILD: ReadonlySet<ChildOrder['status']> = new Set(['CREATED', 'SENDING', 'ACKNOWLEDGED', 'PARTIAL_FILLED', 'CANCEL_PENDING', 'UNKNOWN'])

const PRICE_FIELDS: PriceFieldName[] = ['limit_price', 'trigger_price', 'tp_price', 'sl_price', 'hunt_price']

/** Đọc "a=1,b=2" thành { a: '1', b: '2' }. Phần đầu "MÃ:" (nếu có) bị bỏ. */
export function parseKeyValues(text: string | null | undefined): Record<string, string> {
  if (!text) return {}
  const body = text.includes(':') && !text.split(':')[0].includes('=') ? text.slice(text.indexOf(':') + 1) : text
  const result: Record<string, string> = {}
  for (const part of body.split(',')) {
    const [key, value] = part.split('=')
    if (key && value !== undefined) result[key.trim()] = value.trim()
  }
  return result
}

function toNumber(value: string | undefined | null): number | null {
  if (value === undefined || value === null || value.trim() === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function fieldLabel(order: ParentOrder, name: string): string {
  const label = STRATEGIES[order.strategy_type].fields.find((field) => field.name === name)?.label ?? 'Giá'
  return label.toLowerCase()
}

const lastOf = <T>(items: T[], predicate: (item: T) => boolean): T | undefined => items.filter(predicate).at(-1)

/** Chiều giá phải đi để chạm điều kiện. Cùng quy tắc với `isConditionHit` của engine. */
function conditionDirection(conditionType: 'STOP' | 'TAKE_PROFIT', side: Side): 'UP' | 'DOWN' {
  const hitsWhenRising = conditionType === 'STOP' ? side === 'BUY' : side === 'SELL'
  return hitsWhenRising ? 'UP' : 'DOWN'
}

function buildCondition(label: string, price: number | null, direction: 'UP' | 'DOWN', last: number | null): ConditionInfo | null {
  if (price === null) return null
  if (last === null) return { label, price, gap: null, gap_ticks: null, direction }
  const gap = Math.max(direction === 'UP' ? price - last : last - price, 0)
  return { label, price, gap, gap_ticks: gap === 0 ? 0 : Math.abs(countTicks(Math.min(price, last), Math.max(price, last))), direction }
}

/**
 * Gom mọi dữ kiện của một lệnh để sinh câu giải thích. Hàm thuần: chỉ đọc đầu vào, không đoán số.
 * Số tính thêm (giá trần, sàn, khoảng cách tới giá kích hoạt) đều theo luật có sẵn ở src/utils/hose.ts.
 */
export function buildExplainContext(
  order: ParentOrder,
  children: ChildOrder[],
  events: OrderEvent[],
  market: ExplainMarket,
  extra: ExplainExtra = {},
): ExplainContext {
  const ownEvents = events.filter((event) => event.parent_order_id === order.parent_order_id)
  const ownChildren = children
    .filter((child) => child.parent_order_id === order.parent_order_id)
    .toSorted((a, b) => a.cycle_no - b.cycle_no)
  const params = new Map((extra.parameters ?? []).map((item) => [item.parameter_code, item.parameter_value]))
  const param = (code: string) => toNumber(params.get(code))
  const quote = market.quote
  const ref = quote?.ref_price ?? null
  const ceiling = ref === null ? null : getCeilingPrice(ref)
  const floor = ref === null ? null : getFloorPrice(ref)
  const last = quote?.last_price ?? null

  // Giá ngoài biên độ: ưu tiên bản ghi của engine lúc dừng, không có thì so giá hiện tại với trần, sàn.
  let outOfBand: PriceOutOfBand | null = null
  if (ceiling !== null && floor !== null) {
    const decision = lastOf(ownEvents, (event) => event.action === 'DECISION' && (event.new_value ?? '').startsWith('PRICE_OUT_OF_BAND'))
    const recorded = Object.entries(parseKeyValues(decision?.old_value)).map(([name, value]) => ({ name, value: toNumber(value) }))
    const current = PRICE_FIELDS.map((name) => ({ name, value: name === 'limit_price' ? order.limit_price : param(name) }))
    const candidates = recorded.length > 0 ? recorded : current
    const hit = candidates.find((item) => item.value !== null && (item.value > ceiling || item.value < floor))
    if (hit && hit.value !== null) {
      const above = hit.value > ceiling
      const suggested = above ? ceiling : floor
      outOfBand = {
        field: hit.name as PriceFieldName,
        label: fieldLabel(order, hit.name),
        value: hit.value,
        side: above ? 'ABOVE' : 'BELOW',
        suggested,
        tick: getTickSize(suggested),
      }
    }
  }

  const working = ownChildren.filter((child) => LIVE_CHILD.has(child.status))
  const rejected = ownChildren.filter((child) => child.status === 'REJECTED')
  let streak = 0
  for (const child of ownChildren.toReversed()) {
    if (child.status === 'CANCELLED' && streak === 0) continue // Lệnh con bị hủy lúc dừng lệnh nằm sau lần từ chối.
    if (child.status !== 'REJECTED') break
    streak += 1
  }
  const lastRejectedChild = rejected.at(-1)
  const rejectEvent = lastRejectedChild
    ? lastOf(ownEvents, (event) => event.child_order_id === lastRejectedChild.child_order_id && event.action === 'REJECT')
    : undefined
  const lastReject: RejectInfo | null = lastRejectedChild
    ? {
        child_order_id: lastRejectedChild.child_order_id,
        cycle_no: lastRejectedChild.cycle_no,
        quantity: lastRejectedChild.quantity,
        price: lastRejectedChild.price,
        tick: lastRejectedChild.price === null ? null : getTickSize(lastRejectedChild.price),
        reject_code: rejectEvent?.reject_code ?? null,
        event_id: rejectEvent?.event_id ?? null,
      }
    : null

  const unknownChild = ownChildren.find((child) => child.status === 'UNKNOWN')
  const unknownEvent = unknownChild
    ? lastOf(ownEvents, (event) => event.child_order_id === unknownChild.child_order_id && event.new_value === 'UNKNOWN')
    : undefined

  const killEvent = lastOf(ownEvents, (event) => (event.new_value ?? '').startsWith('KILL_SWITCH:'))
  const killScope = killEvent?.new_value?.slice('KILL_SWITCH:'.length) ?? null
  const haltEvent = lastOf(ownEvents, (event) => event.reason_code === 'SYMBOL_HALTED' && event.child_order_id === null)

  // Điều kiện kích hoạt: Trailing Stop không có giá cố định nên không có ở đây.
  const isTriggered = ownEvents.some((event) => event.action === 'TRIGGER')
  const conditions: ConditionInfo[] = []
  const exitSide: Side = order.side === 'BUY' ? 'SELL' : 'BUY'
  switch (order.strategy_type) {
    case 'STOP':
    case 'STOP_LIMIT':
      conditions.push(buildCondition('giá kích hoạt', param('trigger_price'), conditionDirection('STOP', order.side), last)!)
      break
    case 'TAKE_PROFIT':
      conditions.push(buildCondition('giá kích hoạt', param('trigger_price'), conditionDirection('TAKE_PROFIT', order.side), last)!)
      break
    case 'HUNT':
      conditions.push(buildCondition('giá săn', param('hunt_price'), conditionDirection('TAKE_PROFIT', order.side), last)!)
      break
    case 'OCO':
      conditions.push(buildCondition('giá chốt lời', param('tp_price'), conditionDirection('TAKE_PROFIT', order.side), last)!)
      conditions.push(buildCondition('giá cắt lỗ', param('sl_price'), conditionDirection('STOP', order.side), last)!)
      break
    case 'BRACKET':
      if (order.executed_qty >= order.total_qty) {
        conditions.push(buildCondition('giá chốt lời', param('tp_price'), conditionDirection('TAKE_PROFIT', exitSide), last)!)
        conditions.push(buildCondition('giá cắt lỗ', param('sl_price'), conditionDirection('STOP', exitSide), last)!)
      }
      break
    default:
      break
  }

  const povEvent = lastOf(ownEvents, (event) => event.reason_code === 'POV_THROTTLED')
  const povValues = parseKeyValues(povEvent?.new_value)
  const huntEvent = lastOf(ownEvents, (event) => event.reason_code === 'HUNT_WAITING_LEVEL')

  const lastAction = lastOf(
    ownEvents,
    (event) => event.child_order_id === null && event.new_value === order.status && (event.action === 'PAUSE' || event.action === 'CANCEL'),
  )
  const expireEvent = lastOf(ownEvents, (event) => event.child_order_id === null && event.new_value === 'EXPIRED')

  const quality = extra.executions ? getExecQuality(order, ownChildren, extra.executions, extra.snapshot ?? null, extra.window ?? null) : null
  const roundedBps = quality?.arrivalBps === null || quality?.arrivalBps === undefined ? null : quality.arrivalBps

  return {
    order_id: order.parent_order_id,
    symbol: order.symbol,
    strategy_label: STRATEGIES[order.strategy_type].label,
    side_label: SIDE_LABELS[order.side].toLowerCase(),
    status: order.status,
    reason_code: order.reason_code,
    total_qty: order.total_qty,
    executed_qty: order.executed_qty,
    remaining_qty: Math.max(order.total_qty - order.executed_qty, 0),
    working_qty: working.reduce((sum, child) => sum + child.quantity - child.filled_qty, 0),
    working_children: working.length,
    session: market.session,
    session_label: SESSION_LABELS[market.session],
    can_modify: isModifyCancelAllowed(market.session),
    ref_price: ref,
    ceiling_price: ceiling,
    floor_price: floor,
    band_pct: PRICE_BAND_PCT,
    last_price: last,
    out_of_band: outOfBand,
    quote_age_seconds: market.quote_age_seconds === null ? null : Math.round(market.quote_age_seconds),
    max_delay_seconds: market.max_delay_seconds,
    kill_switch_scope: killScope,
    kill_switch_at: killEvent ? formatDateTime(killEvent.event_time) : null,
    halted_at: haltEvent ? formatDateTime(haltEvent.event_time) : null,
    last_reject: lastReject,
    reject_streak: streak,
    max_rejects: market.max_rejects,
    lot_size: QTY_LOT_SIZE,
    max_order_qty: MAX_ORDER_QTY,
    unknown_child: unknownChild
      ? {
          child_order_id: unknownChild.child_order_id,
          cycle_no: unknownChild.cycle_no,
          open_qty: unknownChild.quantity - unknownChild.filled_qty,
          event_id: unknownEvent?.event_id ?? null,
        }
      : null,
    is_triggered: isTriggered,
    conditions: conditions.filter((item): item is ConditionInfo => item !== null),
    trailing_value: param('trailing_value'),
    pov:
      order.strategy_type === 'POV'
        ? {
            participation_pct: param('participation_pct'),
            max_pct: toNumber(povValues.max_pct) ?? param('max_pct'),
            cap: toNumber(povValues.cap),
            market_qty: toNumber(povValues.market),
          }
        : null,
    hunt:
      order.strategy_type === 'HUNT'
        ? {
            limit_price: order.limit_price,
            best_price: toNumber(huntEvent?.old_value?.replace('BEST:', '')),
            max_wait_min: param('max_wait_min'),
          }
        : null,
    last_action: lastAction ? { user: lastAction.user_id, at: formatDateTime(lastAction.event_time) } : null,
    expire_code: expireEvent?.reason_code ?? null,
    expire_at: expireEvent ? formatDateTime(expireEvent.event_time) : null,
    persistence_label: PERSISTENCE_LABELS[order.persistence_mode],
    valid_to: order.valid_to,
    window_start: params.get('start_time') ?? null,
    window_end: params.get('end_time') ?? null,
    hunt_price: param('hunt_price'),
    avg_price: quality?.avgPrice === null || quality?.avgPrice === undefined ? null : Math.round(quality.avgPrice),
    arrival_price: quality?.arrivalPrice ?? null,
    arrival_bps_text: roundedBps === null ? null : formatBps(roundedBps),
    arrival_favorable: quality?.arrivalFavorable ?? null,
    related_event_id: null,
  }
}
