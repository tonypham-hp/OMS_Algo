import { QTY_LOT_SIZE } from '@/config/hose'
import { STRATEGIES } from '@/config/strategies'
import { formatClock, toDateString } from '@/lib/format'
import { fromCreateOrderRequest, validateOrderValues } from '@/pages/PlaceOrder/orderSchema'
import type {
  ChildOrder,
  ChildOrderStatus,
  ChildOrderType,
  CreateOrderRequest,
  Execution,
  MarketSnapshot,
  MarketState,
  Notification,
  OrderCondition,
  OrderEvent,
  OrderEventAction,
  OrderPriceField,
  ParentOrder,
  ParentOrderStatus,
  PriceFieldName,
  RepriceOrderRequest,
  Side,
  StrategyParameter,
  SessionCode,
  SymbolQuote,
  UpdateOrderRequest,
} from '@/types'
import { formatDate, formatNumber } from '@/lib/format'
import { isAuctionSession, parseTimeToSeconds, validatePrice } from '@/utils/hose'
import { getAllowedActions, isRepriceRequired, isTerminalStatus, type OrderAction } from '@/utils/orderActions'

const LOT = QTY_LOT_SIZE
const VWAP_CYCLE_SECONDS = 300
const SECONDS_PER_DAY = 86_400
/** Mỗi nhịp, một lệnh con khớp tối đa từng này lô, để thấy khớp dần. */
const MAX_FILL_LOTS_PER_TICK = 5

const TERMINAL_CHILD_STATUSES: ReadonlySet<ChildOrderStatus> = new Set([
  'FILLED',
  'CANCELLED',
  'REJECTED',
  'EXPIRED',
])

/** Lỗi nghiệp vụ. `status` là mã HTTP mà API giả lập sẽ trả về. */
export class EngineError extends Error {
  status: number

  constructor(message: string, status = 409) {
    super(message)
    this.name = 'EngineError'
    this.status = status
  }
}

export interface ExecutionReport {
  child_order_id: string
  exchange_match_id: string
  price: number
  qty: number
}

export interface SeedData {
  orders: ParentOrder[]
  parameters: Map<string, StrategyParameter[]>
  conditions: OrderCondition[]
  children: ChildOrder[]
  executions: Execution[]
  snapshots: Map<string, MarketSnapshot>
  events: OrderEvent[]
  notifications: Notification[]
}

interface EngineOptions {
  /** Truyền hàm random có seed khi test để kết quả lặp lại được. */
  random?: () => number
}

/** Dữ liệu engine tự nhớ cho từng lệnh cha, không thuộc ERD. */
interface ParentRuntime {
  createdAtSeconds: number
  cycleNo: number
  /** Điều kiện đã kích hoạt: từ đây lệnh chỉ còn việc sinh lệnh con cho phần còn lại. */
  triggeredConditionId: string | null
  /** TWAP, VWAP: KL đã khớp lúc bắt đầu lịch hiện tại. Sang phiên mới, lịch chia lại phần còn lại. */
  scheduleBaseQty: number
  /** Đỉnh (lệnh bán) hoặc đáy (lệnh mua) của Trailing Stop. */
  trailingExtreme: number | null
  /** POV: tổng KL thị trường đã thấy ở nhịp trước. */
  lastVolume: number | null
  /** POV: phần được phép tham gia đang cộng dồn, tính bằng (cổ phiếu x %) để giữ số nguyên. */
  povAccumulated: number
}

/** Toàn bộ trạng thái của engine ở dạng JSON được, để lưu lại khi tải lại trang. */
export interface EngineState {
  parents: ParentOrder[]
  children: ChildOrder[]
  conditions: OrderCondition[]
  executions: Execution[]
  events: OrderEvent[]
  notifications: Notification[]
  parameters: Array<[string, StrategyParameter[]]>
  snapshots: Array<[string, MarketSnapshot]>
  runtimes: Array<[string, ParentRuntime]>
  seenMatchIds: string[]
  closedDate: string | null
  currentDate: string | null
  previousSession: SessionCode | null
  orderSequence: number
  eventSequence: number
  matchSequence: number
  coreSequence: number
}

export function isChildLive(status: ChildOrderStatus): boolean {
  return !TERMINAL_CHILD_STATUSES.has(status)
}

function roundUpToLot(numerator: number, denominator: number) {
  return Math.ceil(numerator / (denominator * LOT)) * LOT
}

/** KL lũy kế phải đạt đến chu kỳ `index`, chia theo tỷ trọng. Luôn là bội số lô, chu kỳ cuối bằng total. */
function getScheduleTarget(totalQty: number, weights: number[], index: number) {
  const last = weights.length - 1
  if (index >= last) return totalQty
  const sumAll = weights.reduce((sum, weight) => sum + weight, 0)
  const sumDone = weights.slice(0, index + 1).reduce((sum, weight) => sum + weight, 0)
  return Math.min(totalQty, roundUpToLot(totalQty * sumDone, sumAll))
}

export function getTwapTarget(totalQty: number, windowSeconds: number, intervalSeconds: number, elapsedSeconds: number) {
  const cycles = Math.max(1, Math.floor(windowSeconds / intervalSeconds))
  const index = Math.floor(elapsedSeconds / intervalSeconds)
  return getScheduleTarget(totalQty, Array<number>(cycles).fill(1), index)
}

export function getVwapTarget(totalQty: number, windowSeconds: number, elapsedSeconds: number) {
  const cycles = Math.max(1, Math.floor(windowSeconds / VWAP_CYCLE_SECONDS))
  // Tỷ trọng hình chữ U: hai đầu khung giờ nhiều gấp 3 lần ở giữa, mô phỏng thanh khoản trong ngày.
  const weights = Array.from({ length: cycles }, (_, cycle) => {
    const position = (cycle + 0.5) / cycles
    return 1 + 2 * Math.abs(2 * position - 1)
  })
  return getScheduleTarget(totalQty, weights, Math.floor(elapsedSeconds / VWAP_CYCLE_SECONDS))
}

/** Điều kiện đã chạm giá chưa. Với Bracket, `side` là chiều của lệnh thoát. */
export function isConditionHit(conditionType: string, side: Side, lastPrice: number, triggerPrice: number) {
  const hitsWhenRising = conditionType === 'STOP' || conditionType === 'TRAILING_STOP' ? side === 'BUY' : side === 'SELL'
  return hitsWhenRising ? lastPrice >= triggerPrice : lastPrice <= triggerPrice
}

export function createOrderEngine(options: EngineOptions = {}) {
  const random = options.random ?? Math.random
  const getToday = () => market?.trading_date ?? toDateString(new Date())

  let parents: ParentOrder[] = []
  let children: ChildOrder[] = []
  let conditions: OrderCondition[] = []
  let executions: Execution[] = []
  let events: OrderEvent[] = []
  let notifications: Notification[] = []
  const parameters = new Map<string, StrategyParameter[]>()
  const snapshots = new Map<string, MarketSnapshot>()
  const runtimes = new Map<string, ParentRuntime>()
  const seenMatchIds = new Set<string>()
  let market: MarketState | null = null
  /** Ngày đã xử lý đóng cửa, để lệnh nhiều phiên chỉ được mang sang một lần mỗi ngày. */
  let closedDate: string | null = null
  /** Ngày và phiên của nhịp trước, để nhận ra lúc sang ngày mới và lúc hết phiên khớp định kỳ. */
  let currentDate: string | null = null
  let previousSession: SessionCode | null = null
  let orderSequence = 0
  let eventSequence = 0
  let matchSequence = 0
  let coreSequence = 0

  // ===== Đọc dữ liệu =====

  function nowIso() {
    return `${getToday()}T${formatClock(market?.sim_seconds ?? 0)}`
  }

  function currentSeconds() {
    return market?.sim_seconds ?? 0
  }

  function getQuote(symbol: string): SymbolQuote | undefined {
    return market?.quotes.find((quote) => quote.symbol === symbol)
  }

  function requireParent(parentOrderId: string) {
    const parent = parents.find((item) => item.parent_order_id === parentOrderId)
    if (!parent) throw new EngineError('Không tìm thấy lệnh', 404)
    return parent
  }

  function childrenOf(parent: ParentOrder) {
    return children.filter((child) => child.parent_order_id === parent.parent_order_id)
  }

  function isExitChild(parent: ParentOrder, child: ChildOrder) {
    return child.side !== parent.side
  }

  function getParam(parent: ParentOrder, code: string) {
    const list = parameters.get(parent.parent_order_id) ?? []
    return list.find((item) => item.parameter_code === code)?.parameter_value
  }

  function getNumberParam(parent: ParentOrder, code: string) {
    return Number(getParam(parent, code) ?? 0)
  }

  function runtimeOf(parent: ParentOrder): ParentRuntime {
    let runtime = runtimes.get(parent.parent_order_id)
    if (!runtime) {
      runtime = {
        createdAtSeconds: currentSeconds(),
        cycleNo: childrenOf(parent).length,
        triggeredConditionId: null,
        scheduleBaseQty: parent.executed_qty,
        trailingExtreme: null,
        lastVolume: null,
        povAccumulated: 0,
      }
      runtimes.set(parent.parent_order_id, runtime)
    }
    return runtime
  }

  function getTriggeredCondition(parent: ParentOrder) {
    const id = runtimeOf(parent).triggeredConditionId
    return id === null ? undefined : conditions.find((condition) => condition.condition_id === id)
  }

  // ===== Luật lõi (mục 8 của spec) =====

  /** KL đang chờ khớp của lệnh vào. Child UNKNOWN vẫn được tính cho tới khi đối soát xong. */
  function workingOf(parent: ParentOrder) {
    return childrenOf(parent)
      .filter((child) => !isExitChild(parent, child) && isChildLive(child.status))
      .reduce((sum, child) => sum + child.quantity - child.filled_qty, 0)
  }

  /** allowed = total_qty − executed_qty − working. Mọi lệnh con mới đều bị chặn trần bởi hàm này. */
  function allowedOf(parent: ParentOrder) {
    return parent.total_qty - parent.executed_qty - workingOf(parent)
  }

  // ===== Ghi nhận thay đổi: mọi đổi trạng thái đều đi qua đây để luôn có OrderEvent =====

  function logEvent(
    parentOrderId: string,
    childOrderId: string | null,
    action: OrderEventAction,
    oldValue: string | null,
    newValue: string | null,
    userId = 'SYSTEM',
  ) {
    eventSequence += 1
    events.push({
      event_id: `E-${String(eventSequence).padStart(6, '0')}`,
      parent_order_id: parentOrderId,
      child_order_id: childOrderId,
      action,
      user_id: userId,
      channel: userId === 'SYSTEM' ? 'ENGINE' : 'WEB',
      old_value: oldValue,
      new_value: newValue,
      event_time: nowIso(),
    })
  }

  function setParentStatus(parent: ParentOrder, next: ParentOrderStatus, action: OrderEventAction, userId?: string) {
    const previous = parent.status
    parent.status = next
    parent.updated_at = nowIso()
    logEvent(parent.parent_order_id, null, action, previous, next, userId)
  }

  function setChildStatus(child: ChildOrder, next: ChildOrderStatus, action: OrderEventAction, userId?: string) {
    const previous = child.status
    child.status = next
    logEvent(child.parent_order_id, child.child_order_id, action, previous, next, userId)
  }

  function createChild(parent: ParentOrder, side: Side, orderType: ChildOrderType, price: number | null, quantity: number) {
    if (quantity <= 0) return
    // MTL không hợp lệ trong ATO, ATC: lệnh không có giá ở hai phiên này là lệnh ATO, ATC.
    const session = market?.session
    const finalType = orderType === 'MTL' && session && isAuctionSession(session) ? (session as ChildOrderType) : orderType
    const runtime = runtimeOf(parent)
    runtime.cycleNo += 1
    const childId = `${parent.parent_order_id}-CH${String(runtime.cycleNo).padStart(3, '0')}`
    children.push({
      child_order_id: childId,
      parent_order_id: parent.parent_order_id,
      cycle_no: runtime.cycleNo,
      side,
      order_type: finalType,
      price,
      quantity,
      filled_qty: 0,
      status: 'CREATED',
      client_order_id: `CL-${childId}`,
      idempotency_key: `IDEM-${childId}`,
      core_order_id: null,
      created_at: nowIso(),
      sent_at: null,
    })
    logEvent(parent.parent_order_id, childId, 'CHILD_CREATE', null, 'CREATED')
  }

  /** Hủy lệnh con đang chờ. Child UNKNOWN giữ nguyên vì chưa biết Core đang giữ gì. */
  function cancelOpenChildren(parent: ParentOrder, userId?: string) {
    for (const child of childrenOf(parent)) {
      if (isChildLive(child.status) && child.status !== 'UNKNOWN') {
        setChildStatus(child, 'CANCELLED', 'CANCEL', userId)
      }
    }
  }

  function cancelConditions(parent: ParentOrder, except: OrderCondition | null, userId?: string) {
    for (const condition of conditions) {
      if (
        condition.parent_order_id === parent.parent_order_id &&
        condition.status === 'ACTIVE' &&
        condition !== except
      ) {
        condition.status = 'CANCELLED'
        logEvent(parent.parent_order_id, null, 'CANCEL', `CONDITION:${condition.condition_type}:ACTIVE`, 'CANCELLED', userId)
      }
    }
  }

  function expireParent(parent: ParentOrder) {
    for (const child of childrenOf(parent)) {
      if (!isChildLive(child.status)) continue
      setChildStatus(child, 'EXPIRED', child.status === 'UNKNOWN' ? 'RECOVERY' : 'DECISION')
    }
    cancelConditions(parent, null)
    setParentStatus(parent, 'EXPIRED', 'DECISION')
  }

  /** Chốt trạng thái lệnh cha sau khi có thay đổi. */
  function settleParent(parent: ParentOrder) {
    if (isTerminalStatus(parent.status)) return

    if (parent.status === 'CANCEL_PENDING') {
      if (!childrenOf(parent).some((child) => isChildLive(child.status))) {
        setParentStatus(parent, 'CANCELLED', 'CANCEL')
      }
      return
    }

    const isFull = parent.executed_qty >= parent.total_qty && workingOf(parent) === 0
    if (!isFull) return

    if (parent.strategy_type === 'BRACKET') {
      const exited = childrenOf(parent)
        .filter((child) => isExitChild(parent, child))
        .reduce((sum, child) => sum + child.filled_qty, 0)
      if (exited < parent.executed_qty) return
    }
    cancelConditions(parent, null)
    setParentStatus(parent, 'COMPLETED', 'DECISION')
  }

  /**
   * Lối duy nhất để cộng KL khớp.
   * Trùng exchange_match_id thì bỏ qua. KL vượt phần còn lại thì cắt bớt, nên không bao giờ vượt total_qty.
   * Trả về true nếu báo khớp được ghi nhận.
   */
  function applyExecution(report: ExecutionReport): boolean {
    if (seenMatchIds.has(report.exchange_match_id)) return false
    const child = children.find((item) => item.child_order_id === report.child_order_id)
    if (!child) return false
    const parent = requireParent(child.parent_order_id)
    seenMatchIds.add(report.exchange_match_id)

    if (!isChildLive(child.status)) return false
    const exit = isExitChild(parent, child)
    const childRemaining = child.quantity - child.filled_qty
    const parentRemaining = exit ? childRemaining : parent.total_qty - parent.executed_qty
    const qty = Math.min(report.qty, childRemaining, parentRemaining)
    if (qty <= 0) return false

    const now = nowIso()
    executions.push({
      execution_id: `X-${report.exchange_match_id}`,
      child_order_id: child.child_order_id,
      parent_order_id: parent.parent_order_id,
      exchange_match_id: report.exchange_match_id,
      price: report.price,
      qty,
      match_time: now,
    })
    child.filled_qty += qty
    setChildStatus(child, child.filled_qty >= child.quantity ? 'FILLED' : 'PARTIAL_FILLED', 'FILL')

    if (!exit) parent.executed_qty += qty
    parent.updated_at = now
    if (parent.status === 'ACTIVE') setParentStatus(parent, 'PARTIALLY_EXECUTED', 'DECISION')
    settleParent(parent)
    return true
  }

  // ===== Các bước trong một nhịp =====

  function sendCreatedChildren(parent: ParentOrder) {
    for (const child of childrenOf(parent)) {
      if (child.status !== 'CREATED') continue
      coreSequence += 1
      child.core_order_id = `CORE-${String(coreSequence).padStart(6, '0')}`
      child.sent_at = nowIso()
      setChildStatus(child, 'ACKNOWLEDGED', 'CHILD_SEND')
    }
  }

  /** Lệnh không giá (MTL, ATO, ATC) luôn khớp được. LO khớp khi giá không tệ hơn giá đặt. */
  function isMarketable(child: ChildOrder, price: number) {
    if (child.price === null) return true
    return child.side === 'BUY' ? price <= child.price : price >= child.price
  }

  function fillChild(child: ChildOrder, price: number, qty: number) {
    matchSequence += 1
    applyExecution({
      child_order_id: child.child_order_id,
      exchange_match_id: `M-${String(matchSequence).padStart(7, '0')}`,
      price,
      qty,
    })
  }

  function getOpenChildren(parent: ParentOrder) {
    return childrenOf(parent).filter((child) => child.status === 'ACKNOWLEDGED' || child.status === 'PARTIAL_FILLED')
  }

  /** Phiên liên tục: khớp dần từng phần. */
  function fillChildren(parent: ParentOrder, quote: SymbolQuote) {
    for (const child of getOpenChildren(parent)) {
      if (!isMarketable(child, quote.last_price)) continue
      fillChild(child, quote.last_price, (1 + Math.floor(random() * MAX_FILL_LOTS_PER_TICK)) * LOT)
    }
  }

  /** Hết phiên ATO, ATC: khớp một lần duy nhất tại giá khớp định kỳ, lệnh đủ điều kiện khớp hết. */
  function matchAuctionChildren(parent: ParentOrder, quote: SymbolQuote) {
    for (const child of getOpenChildren(parent)) {
      if (isMarketable(child, quote.last_price)) {
        fillChild(child, quote.last_price, child.quantity - child.filled_qty)
      }
    }
  }

  /** Vào ATC: MTL còn sót không còn hợp lệ, hủy để nhịp sau sinh lại thành lệnh ATC. */
  function cancelOpenMtlChildren(parent: ParentOrder) {
    for (const child of getOpenChildren(parent)) {
      if (child.order_type === 'MTL') setChildStatus(child, 'CANCELLED', 'CANCEL')
    }
  }

  /**
   * Các giá lệnh còn dùng tới, nên phải nằm trong biên độ. Giá đã hết tác dụng không tính:
   * giá giới hạn khi đã vào đủ KL (Bracket đang chờ thoát), giá kích hoạt khi đã kích hoạt,
   * giá SL sau khi kích hoạt (lệnh con là MTL). Giá TP vẫn tính vì lệnh con LO đặt đúng giá đó.
   * Trailing Stop không có ở đây vì giá kích hoạt do engine tính, bám theo thị trường.
   */
  function getActivePriceFields(parent: ParentOrder): OrderPriceField[] {
    const triggered = getTriggeredCondition(parent)
    const isUsed: Record<PriceFieldName, boolean> = {
      limit_price: parent.executed_qty < parent.total_qty,
      trigger_price: !triggered,
      hunt_price: !triggered,
      sl_price: !triggered,
      tp_price: !triggered || triggered.condition_type === 'TAKE_PROFIT',
    }
    const fields: OrderPriceField[] = []
    for (const field of STRATEGIES[parent.strategy_type].fields) {
      if (field.kind !== 'price') continue
      const name = field.name as PriceFieldName
      if (!isUsed[name]) continue
      const value = name === 'limit_price' ? parent.limit_price : getNumberParam(parent, name)
      if (value !== null) fields.push({ name, value })
    }
    return fields
  }

  /**
   * Đầu ngày mới: giá của lệnh mang sang có thể nằm ngoài trần, sàn mới.
   * Lệnh đó không được sinh lệnh con nữa, chuyển PAUSED_SYSTEM và báo lý do.
   */
  function checkCarriedPrices(parent: ParentOrder) {
    const quote = getQuote(parent.symbol)
    if (!quote) return
    if (parent.status === 'PAUSED_SYSTEM' || parent.status === 'CANCEL_PENDING') return
    const outOfBand = getActivePriceFields(parent).filter(
      (field) => field.value < quote.floor_price || field.value > quote.ceiling_price,
    )
    if (outOfBand.length === 0) return

    parent.reason_code = 'PRICE_OUT_OF_BAND'
    setParentStatus(parent, 'PAUSED_SYSTEM', 'PAUSE')
    logEvent(
      parent.parent_order_id,
      null,
      'DECISION',
      outOfBand.map((field) => `${field.name}=${field.value}`).join(','),
      `PRICE_OUT_OF_BAND:floor=${quote.floor_price},ceiling=${quote.ceiling_price}`,
    )
    const labels = STRATEGIES[parent.strategy_type].fields
    const prices = outOfBand
      .map((item) => `${labels.find((field) => field.name === item.name)?.label} ${formatNumber(item.value)}`)
      .join(', ')
    notifications.push({
      notification_type: 'PARENT_PAUSED',
      parent_order_id: parent.parent_order_id,
      message: `Lệnh ${parent.parent_order_id} tạm dừng: ${prices} nằm ngoài biên độ ngày ${formatDate(getToday())} (sàn ${formatNumber(quote.floor_price)}, trần ${formatNumber(quote.ceiling_price)}).`,
      sent_at: nowIso(),
    })
  }

  function triggerCondition(parent: ParentOrder, condition: OrderCondition) {
    condition.status = 'TRIGGERED'
    condition.triggered_at = nowIso()
    runtimeOf(parent).triggeredConditionId = condition.condition_id
    logEvent(parent.parent_order_id, null, 'TRIGGER', `CONDITION:${condition.condition_type}:ACTIVE`, 'TRIGGERED')
    // OCO: một bên kích hoạt thì bên kia bị hủy.
    cancelConditions(parent, condition)
  }

  function checkConditions(parent: ParentOrder, side: Side, last: number) {
    if (runtimeOf(parent).triggeredConditionId !== null) return
    // Trong ATO, ATC chưa có giao dịch mới nên giá khớp chỉ là giá cũ, không được dùng để kích hoạt.
    if (market?.session !== 'CONTINUOUS') return
    for (const condition of conditions) {
      if (condition.parent_order_id !== parent.parent_order_id || condition.status !== 'ACTIVE') continue
      if (condition.trigger_price === null) continue
      if (isConditionHit(condition.condition_type, side, last, condition.trigger_price)) {
        triggerCondition(parent, condition)
        return
      }
    }
  }

  function updateTrailing(parent: ParentOrder, last: number) {
    const runtime = runtimeOf(parent)
    const condition = conditions.find((item) => item.parent_order_id === parent.parent_order_id)
    if (!condition || runtime.triggeredConditionId !== null) return
    const value = getNumberParam(parent, 'trailing_value')
    if (parent.side === 'SELL') {
      runtime.trailingExtreme = Math.max(runtime.trailingExtreme ?? last, last)
      condition.trigger_price = runtime.trailingExtreme - value
    } else {
      runtime.trailingExtreme = Math.min(runtime.trailingExtreme ?? last, last)
      condition.trigger_price = runtime.trailingExtreme + value
    }
  }

  /** Lệnh con sau khi một điều kiện kích hoạt: SL và Stop là MTL, còn lại là LO. */
  function getTriggeredChildSpec(parent: ParentOrder, condition: OrderCondition): { type: ChildOrderType; price: number | null } {
    switch (parent.strategy_type) {
      case 'OCO':
      case 'BRACKET':
        return condition.condition_type === 'TAKE_PROFIT'
          ? { type: 'LO', price: condition.trigger_price }
          : { type: 'MTL', price: null }
      case 'STOP':
      case 'TRAILING_STOP':
        return { type: 'MTL', price: null }
      default:
        return { type: 'LO', price: parent.limit_price }
    }
  }

  function stepConditional(parent: ParentOrder, last: number) {
    if (parent.strategy_type === 'TRAILING_STOP') updateTrailing(parent, last)
    checkConditions(parent, parent.side, last)
    const triggered = getTriggeredCondition(parent)
    if (!triggered) return
    const spec = getTriggeredChildSpec(parent, triggered)
    createChild(parent, parent.side, spec.type, spec.price, allowedOf(parent))
  }

  function stepBracket(parent: ParentOrder, last: number) {
    const allowed = allowedOf(parent)
    if (allowed > 0) {
      createChild(parent, parent.side, 'LO', parent.limit_price, allowed)
      return
    }
    if (workingOf(parent) > 0) return

    // Lệnh vào đã khớp đủ: chuyển sang theo dõi cặp TP/SL với chiều ngược lại.
    const exitSide: Side = parent.side === 'BUY' ? 'SELL' : 'BUY'
    checkConditions(parent, exitSide, last)
    const triggered = getTriggeredCondition(parent)
    if (!triggered) return
    const exitChildren = childrenOf(parent).filter((child) => isExitChild(parent, child))
    const covered = exitChildren.reduce(
      (sum, child) => sum + (isChildLive(child.status) ? child.quantity : child.filled_qty),
      0,
    )
    const spec = getTriggeredChildSpec(parent, triggered)
    createChild(parent, exitSide, spec.type, spec.price, parent.executed_qty - covered)
  }

  function getWindow(parent: ParentOrder) {
    const start = parseTimeToSeconds(getParam(parent, 'start_time') ?? '')
    const end = parseTimeToSeconds(getParam(parent, 'end_time') ?? '')
    return start === null || end === null ? null : { start, end }
  }

  function stepSchedule(parent: ParentOrder) {
    const window = getWindow(parent)
    const seconds = currentSeconds()
    if (!window || seconds < window.start || seconds >= window.end) return
    const elapsed = seconds - window.start
    const windowSeconds = window.end - window.start
    const base = runtimeOf(parent).scheduleBaseQty
    const planQty = parent.total_qty - base
    const target =
      base +
      (parent.strategy_type === 'TWAP'
        ? getTwapTarget(planQty, windowSeconds, getNumberParam(parent, 'interval_min') * 60, elapsed)
        : getVwapTarget(planQty, windowSeconds, elapsed))
    const qty = Math.min(target - parent.executed_qty - workingOf(parent), allowedOf(parent))
    createChild(parent, parent.side, 'LO', parent.limit_price, qty)
  }

  function stepPov(parent: ParentOrder, quote: SymbolQuote) {
    const runtime = runtimeOf(parent)
    const previous = runtime.lastVolume
    runtime.lastVolume = quote.total_volume
    if (previous === null) return
    const delta = quote.total_volume - previous
    runtime.povAccumulated += delta * getNumberParam(parent, 'participation_pct')
    // Chia cho (100 x lô) rồi nhân lại: chỉ lấy phần đủ lô, phần lẻ để dành cho nhịp sau.
    const wanted = Math.floor(runtime.povAccumulated / (100 * LOT)) * LOT
    const cap = Math.floor((delta * getNumberParam(parent, 'max_pct')) / (100 * LOT)) * LOT
    const qty = Math.min(wanted, cap, allowedOf(parent))
    if (qty <= 0) return
    runtime.povAccumulated -= qty * 100
    createChild(parent, parent.side, 'LO', parent.limit_price, qty)
  }

  function stepParent(parent: ParentOrder, quote: SymbolQuote) {
    const last = quote.last_price
    switch (parent.strategy_type) {
      case 'STOP':
      case 'STOP_LIMIT':
      case 'TAKE_PROFIT':
      case 'TRAILING_STOP':
      case 'OCO':
      case 'HUNT':
        stepConditional(parent, last)
        break
      case 'BRACKET':
        stepBracket(parent, last)
        break
      case 'ICEBERG':
        if (workingOf(parent) === 0) {
          createChild(parent, parent.side, 'LO', parent.limit_price, Math.min(getNumberParam(parent, 'slice_qty'), allowedOf(parent)))
        }
        break
      case 'TWAP':
      case 'VWAP':
        stepSchedule(parent)
        break
      case 'POV':
        stepPov(parent, quote)
        break
    }
  }

  function isRunning(parent: ParentOrder) {
    return parent.status === 'ACTIVE' || parent.status === 'PARTIALLY_EXECUTED'
  }

  /** Các loại lệnh có hạn riêng trong ngày: chạy ở mọi phiên, vì giờ hết hạn có thể rơi vào lúc nghỉ trưa. */
  function checkOwnDeadline(parent: ParentOrder) {
    const seconds = currentSeconds()
    if (parent.strategy_type === 'TWAP' || parent.strategy_type === 'VWAP') {
      const window = getWindow(parent)
      if (!window || seconds < window.end) return
      // Hết khung giờ: lệnh trong ngày kết thúc, còn lệnh nhiều phiên chờ khung giờ của phiên sau.
      if (parent.persistence_mode === 'DAY') expireParent(parent)
      else cancelOpenChildren(parent)
    } else if (parent.strategy_type === 'HUNT' && runtimeOf(parent).triggeredConditionId === null) {
      const deadline = runtimeOf(parent).createdAtSeconds + getNumberParam(parent, 'max_wait_min') * 60
      if (seconds >= deadline) expireParent(parent)
    }
  }

  /**
   * Hết ngày giao dịch, xử lý theo persistence_mode:
   * DAY hết hạn. GTD và MULTI_SESSION chưa tới valid_to thì mang phần còn lại sang phiên sau.
   */
  function closeDay(parent: ParentOrder) {
    const today = getToday()
    if (parent.persistence_mode === 'DAY' || parent.valid_to <= today) {
      expireParent(parent)
      return
    }

    // Lệnh con không qua được ngày mới. Child UNKNOWN giữ nguyên vì chưa đối soát xong.
    for (const child of childrenOf(parent)) {
      if (isChildLive(child.status) && child.status !== 'UNKNOWN') setChildStatus(child, 'EXPIRED', 'DECISION')
    }

    const runtime = runtimeOf(parent)
    runtime.scheduleBaseQty = parent.executed_qty
    runtime.lastVolume = null // KL thị trường đếm lại từ 0 vào ngày mới.
    runtime.povAccumulated = 0
    runtime.createdAtSeconds -= SECONDS_PER_DAY // Giữ đúng hạn chờ của HUNT khi giờ trong ngày quay về đầu.
    logEvent(
      parent.parent_order_id,
      null,
      'DECISION',
      `SESSION:${today}`,
      `CARRY_OVER:${parent.total_qty - parent.executed_qty}`,
    )
  }

  /** Một nhịp của thị trường: gửi lệnh con, khớp, kiểm tra điều kiện, sinh lệnh con mới, chốt trạng thái. */
  function onMarketTick(state: MarketState) {
    // Đổi tốc độ cũng phát lại trạng thái, nhưng đồng hồ chưa nhích thì chưa phải một nhịp mới.
    const isSameMoment = market?.sim_seconds === state.sim_seconds && market?.trading_date === state.trading_date
    market = state
    if (isSameMoment) return

    const previous = previousSession
    const isNewDay = currentDate !== null && currentDate !== state.trading_date
    previousSession = state.session
    currentDate = state.trading_date
    const liveParents = parents.filter((parent) => !isTerminalStatus(parent.status))

    if (isNewDay) for (const parent of liveParents) checkCarriedPrices(parent)

    for (const parent of liveParents) {
      sendCreatedChildren(parent)
      if (parent.status === 'CANCEL_PENDING') reconcilePendingCancel(parent)
      settleParent(parent)
    }

    // Vừa hết phiên ATO, ATC: bộ giả lập đã chốt giá khớp định kỳ ở nhịp này.
    if (previous !== null && isAuctionSession(previous) && state.session !== previous) {
      for (const parent of liveParents) {
        const quote = getQuote(parent.symbol)
        if (quote && isRunning(parent)) matchAuctionChildren(parent, quote)
      }
    }

    if (state.session === 'ATC' && previous !== 'ATC') {
      for (const parent of liveParents) if (isRunning(parent)) cancelOpenMtlChildren(parent)
    }

    if (state.session === 'CLOSED') {
      if (closedDate !== state.trading_date) {
        closedDate = state.trading_date
        for (const parent of liveParents) if (!isTerminalStatus(parent.status)) closeDay(parent)
      }
      return
    }

    for (const parent of liveParents) if (isRunning(parent)) checkOwnDeadline(parent)

    // Nghỉ trưa và trước giờ mở cửa không gửi lệnh mới. ATO, ATC gửi lệnh được nhưng chỉ khớp lúc hết phiên.
    if (state.session !== 'CONTINUOUS' && !isAuctionSession(state.session)) return

    for (const parent of liveParents) {
      const quote = getQuote(parent.symbol)
      if (!quote) continue
      if (state.session === 'CONTINUOUS' && isRunning(parent)) fillChildren(parent, quote)
      if (isRunning(parent)) stepParent(parent, quote)
      settleParent(parent)
    }
  }

  /** Lệnh đang hủy mà còn Child UNKNOWN: đối soát ngay ở nhịp sau để lệnh không bị kẹt mãi. */
  function reconcilePendingCancel(parent: ParentOrder) {
    for (const child of childrenOf(parent)) {
      if (child.status === 'UNKNOWN') setChildStatus(child, 'CANCELLED', 'RECOVERY')
    }
  }

  // ===== Thao tác của người dùng =====

  function assertAllowed(parent: ParentOrder, action: OrderAction) {
    const availability = getAllowedActions(parent.status, market?.session ?? 'CLOSED', parent.reason_code)[action]
    if (!availability.allowed) throw new EngineError(availability.reason ?? 'Không được phép thao tác')
  }

  function buildConditions(parent: ParentOrder): OrderCondition[] {
    const id = parent.parent_order_id
    const create = (index: number, type: string, code: string | null, group: string | null = null): OrderCondition => ({
      condition_id: `${id}-C${index}`,
      parent_order_id: id,
      condition_type: type,
      trigger_price: code ? getNumberParam(parent, code) : null,
      oco_group_id: group,
      status: 'ACTIVE',
      triggered_at: null,
    })

    switch (parent.strategy_type) {
      case 'STOP':
      case 'STOP_LIMIT':
        return [create(1, 'STOP', 'trigger_price')]
      case 'TAKE_PROFIT':
        return [create(1, 'TAKE_PROFIT', 'trigger_price')]
      case 'TRAILING_STOP':
        return [create(1, 'TRAILING_STOP', null)]
      case 'HUNT':
        return [create(1, 'HUNT', 'hunt_price')]
      case 'OCO':
      case 'BRACKET':
        return [
          create(1, 'TAKE_PROFIT', 'tp_price', `OCO-${id}`),
          create(2, 'STOP', 'sl_price', `OCO-${id}`),
        ]
      default:
        return []
    }
  }

  function createOrder(request: CreateOrderRequest, userId: string): ParentOrder {
    const today = getToday()
    const now = nowIso()
    orderSequence += 1
    const parentOrderId = `PO-${today.replaceAll('-', '')}-${String(orderSequence).padStart(4, '0')}`
    const parent: ParentOrder = {
      parent_order_id: parentOrderId,
      client_request_id: request.client_request_id,
      account_no: request.account_no,
      symbol: request.symbol,
      side: request.side,
      total_qty: request.total_qty,
      executed_qty: 0,
      limit_price: request.limit_price,
      strategy_type: request.strategy_type,
      status: 'ACTIVE',
      reason_code: null,
      valid_from: now,
      valid_to: request.valid_to ?? today,
      persistence_mode: request.persistence_mode,
      version: 1,
      created_at: now,
      updated_at: now,
    }
    parents.push(parent)
    runtimeOf(parent) // Ghi nhận giờ tạo ngay, vì hạn chờ của HUNT tính từ lúc này.
    parameters.set(parentOrderId, request.parameters)
    conditions.push(...buildConditions(parent))
    const quote = getQuote(request.symbol)
    if (quote) {
      snapshots.set(parentOrderId, {
        arrival_price: quote.last_price,
        arrival_bid: quote.bid_price,
        arrival_ask: quote.ask_price,
        arrival_timestamp: now,
      })
    }
    logEvent(parentOrderId, null, 'CREATE', null, 'ACTIVE', userId)
    return parent
  }

  function pauseOrder(parentOrderId: string, userId: string) {
    const parent = requireParent(parentOrderId)
    assertAllowed(parent, 'pause')
    cancelOpenChildren(parent, userId)
    setParentStatus(parent, 'PAUSED_USER', 'PAUSE', userId)
    return parent
  }

  function resumeOrder(parentOrderId: string, userId: string) {
    const parent = requireParent(parentOrderId)
    assertAllowed(parent, 'resume')
    // Lúc tạm dừng thị trường vẫn chạy: bỏ phần KL đó để POV không tính bù một lần.
    const runtime = runtimeOf(parent)
    runtime.lastVolume = null
    runtime.povAccumulated = 0
    setParentStatus(parent, parent.executed_qty > 0 ? 'PARTIALLY_EXECUTED' : 'ACTIVE', 'RESUME', userId)
    settleParent(parent)
    return parent
  }

  function cancelOrder(parentOrderId: string, userId: string) {
    const parent = requireParent(parentOrderId)
    assertAllowed(parent, 'cancel')
    setParentStatus(parent, 'CANCEL_PENDING', 'CANCEL', userId)
    cancelOpenChildren(parent, userId)
    cancelConditions(parent, null, userId)
    settleParent(parent)
    return parent
  }

  function updateOrder(parentOrderId: string, request: UpdateOrderRequest, userId: string) {
    const parent = requireParent(parentOrderId)
    assertAllowed(parent, 'edit')
    if (isRepriceRequired(parent.status, parent.reason_code)) {
      throw new EngineError('Lệnh đang tạm dừng vì giá ngoài biên độ, chỉ được sửa giá')
    }
    if (request.version !== parent.version) {
      throw new EngineError('Lệnh vừa được thay đổi ở nơi khác, vui lòng mở lại để sửa')
    }

    const hasLimitPrice = STRATEGIES[parent.strategy_type].fields.some((field) => field.name === 'limit_price')
    const limitPrice = hasLimitPrice ? request.limit_price : null
    const isBracket = parent.strategy_type === 'BRACKET'
    if (isBracket && parent.executed_qty >= parent.total_qty && workingOf(parent) === 0) {
      throw new EngineError('Lệnh Bracket đã vào đủ, không sửa được nữa')
    }

    // Dùng lại luật của ticket, nhưng chỉ xét các ô đang sửa và các ô phụ thuộc giá của Bracket.
    const checkedFields = new Set<string>(isBracket ? ['total_qty', 'limit_price', 'tp_price', 'sl_price'] : ['total_qty', 'limit_price'])
    const errors = validateOrderValues(
      fromCreateOrderRequest({
        client_request_id: parent.client_request_id,
        account_no: parent.account_no,
        symbol: parent.symbol,
        side: parent.side,
        total_qty: request.total_qty,
        limit_price: limitPrice,
        strategy_type: parent.strategy_type,
        persistence_mode: parent.persistence_mode,
        valid_to: parent.valid_to,
        parameters: parameters.get(parent.parent_order_id) ?? [],
      }),
      { getQuote, today: getToday() },
    ).filter((error) => checkedFields.has(error.field))
    if (errors.length > 0) throw new EngineError(errors[0].message, 422)

    const unknownQty = childrenOf(parent)
      .filter((child) => child.status === 'UNKNOWN')
      .reduce((sum, child) => sum + child.quantity - child.filled_qty, 0)
    const minimum = parent.executed_qty + unknownQty
    if (request.total_qty < minimum) {
      throw new EngineError(`Khối lượng mới không được nhỏ hơn ${minimum} (đã khớp cộng lệnh con chưa rõ)`, 422)
    }

    const oldValue = JSON.stringify({ total_qty: parent.total_qty, limit_price: parent.limit_price })
    cancelOpenChildren(parent, userId)
    parent.total_qty = request.total_qty
    parent.limit_price = limitPrice
    parent.version += 1
    parent.updated_at = nowIso()
    logEvent(  
      parent.parent_order_id,
      null,
      'MODIFY',
      oldValue,
      JSON.stringify({ total_qty: parent.total_qty, limit_price: parent.limit_price }),
      userId,
    )
    settleParent(parent)
    return parent
  }

  /** Các giá cần sửa của lệnh đang tạm dừng vì giá ngoài biên độ. */
  function getRepriceFields(parentOrderId: string) {
    return getActivePriceFields(requireParent(parentOrderId))
  }

  /**
   * Sửa giá lệnh PAUSED_SYSTEM do giá ngoài biên độ. Mọi giá còn dùng tới phải hợp lệ trong biên độ
   * ngày hiện tại thì mới nhận, và lệnh tự chạy lại. KL không đổi. Giá không còn dùng tới bị bỏ qua.
   */
  function repriceOrder(parentOrderId: string, request: RepriceOrderRequest, userId: string) {
    const parent = requireParent(parentOrderId)
    assertAllowed(parent, 'edit')
    if (!isRepriceRequired(parent.status, parent.reason_code)) {
      throw new EngineError('Chỉ sửa giá được với lệnh tạm dừng vì giá ngoài biên độ')
    }
    if (request.version !== parent.version) {
      throw new EngineError('Lệnh vừa được thay đổi ở nơi khác, vui lòng mở lại để sửa')
    }
    const quote = getQuote(parent.symbol)
    if (!quote) throw new EngineError('Chưa có giá của mã này, vui lòng thử lại')

    const before = getActivePriceFields(parent)
    const after = before.map((field) => ({ ...field, value: request.prices[field.name] ?? field.value }))
    const newParameters = (parameters.get(parent.parent_order_id) ?? []).map((parameter) => {
      const changed = after.find((field) => field.name === parameter.parameter_code)
      return changed ? { ...parameter, parameter_value: String(changed.value) } : parameter
    })
    const newLimit = after.find((field) => field.name === 'limit_price')?.value ?? parent.limit_price

    // Đã kích hoạt hoặc đã vào đủ KL thì các giá gốc không còn so sánh được với nhau, chỉ xét biên độ.
    const checkBandOnly = getTriggeredCondition(parent) !== undefined || parent.executed_qty >= parent.total_qty
    const activeNames = new Set<string>(before.map((field) => field.name))
    const errors = checkBandOnly
      ? after.map((field) => validatePrice(field.value, quote.ref_price)).filter((message) => message !== null)
      : validateOrderValues(
          fromCreateOrderRequest({
            client_request_id: parent.client_request_id,
            account_no: parent.account_no,
            symbol: parent.symbol,
            side: parent.side,
            total_qty: parent.total_qty,
            limit_price: newLimit,
            strategy_type: parent.strategy_type,
            persistence_mode: parent.persistence_mode,
            valid_to: parent.valid_to,
            parameters: newParameters,
          }),
          { getQuote, today: getToday() },
        )
          .filter((error) => activeNames.has(error.field))
          .map((error) => error.message)
    if (errors.length > 0) throw new EngineError(errors[0], 422)

    const toText = (fields: OrderPriceField[]) =>
      JSON.stringify(Object.fromEntries(fields.map((field) => [field.name, field.value])))
    parameters.set(parent.parent_order_id, newParameters)
    parent.limit_price = newLimit
    for (const field of after) {
      const condition = conditions.find(
        (item) =>
          item.parent_order_id === parent.parent_order_id &&
          (field.name === 'trigger_price' ||
            (field.name === 'tp_price' && item.condition_type === 'TAKE_PROFIT') ||
            (field.name === 'sl_price' && item.condition_type === 'STOP') ||
            (field.name === 'hunt_price' && item.condition_type === 'HUNT')),
      )
      if (condition) condition.trigger_price = field.value
    }
    parent.version += 1
    parent.reason_code = null
    logEvent(parent.parent_order_id, null, 'MODIFY', toText(before), toText(after), userId)
    setParentStatus(parent, parent.executed_qty > 0 ? 'PARTIALLY_EXECUTED' : 'ACTIVE', 'RESUME', userId)
    settleParent(parent)
    return parent
  }

  // ===== Dành cho đối soát và nút bơm lỗi (Màn 4) =====

  /** Mất phản hồi từ Core: lệnh con chuyển UNKNOWN nhưng vẫn tính là working. */
  function markChildUnknown(childOrderId: string) {
    const child = children.find((item) => item.child_order_id === childOrderId)
    if (!child || !isChildLive(child.status)) throw new EngineError('Không tìm thấy lệnh con đang chờ', 404)
    setChildStatus(child, 'UNKNOWN', 'CHILD_UNKNOWN')
  }
  /** Đối soát xong: phần chưa khớp của Child UNKNOWN được giải phóng để sinh lại. */
  function reconcileUnknownChild(childOrderId: string) {
    const child = children.find((item) => item.child_order_id === childOrderId)
    if (!child || child.status !== 'UNKNOWN') throw new EngineError('Không tìm thấy lệnh con UNKNOWN', 404)
    setChildStatus(child, 'CANCELLED', 'RECOVERY')
    settleParent(requireParent(child.parent_order_id))
  }

  // ===== Dữ liệu ===== 

  function load(seed: SeedData) {
    parents = seed.orders.map((order) => ({ ...order }))
    children = seed.children.map((child) => ({ ...child }))
    conditions = seed.conditions.map((condition) => ({ ...condition }))
    executions = seed.executions.map((execution) => ({ ...execution }))
    events = seed.events.map((event) => ({ ...event }))
    parameters.clear()
    seed.parameters.forEach((value, key) => parameters.set(key, value))
    snapshots.clear()
    seed.snapshots.forEach((value, key) => snapshots.set(key, value))
    runtimes.clear()
    seenMatchIds.clear()
    executions.forEach((execution) => seenMatchIds.add(execution.exchange_match_id))
    notifications = seed.notifications.map((notification) => ({ ...notification }))
    closedDate = null
    currentDate = null
    previousSession = null
    orderSequence = seed.orders.length
    eventSequence = seed.events.length
  }

  function exportState(): EngineState {
    return {
      parents,
      children,
      conditions,
      executions,
      events,
      notifications,
      parameters: [...parameters],
      snapshots: [...snapshots],
      runtimes: [...runtimes],
      seenMatchIds: [...seenMatchIds],
      closedDate,
      currentDate,
      previousSession,
      orderSequence,
      eventSequence,
      matchSequence,
      coreSequence,
    }
  }

  function importState(state: EngineState) {
    parents = state.parents
    children = state.children
    conditions = state.conditions
    executions = state.executions
    events = state.events
    notifications = state.notifications
    parameters.clear()
    state.parameters.forEach(([key, value]) => parameters.set(key, value))
    snapshots.clear()
    state.snapshots.forEach(([key, value]) => snapshots.set(key, value))
    runtimes.clear()
    state.runtimes.forEach(([key, value]) => runtimes.set(key, value))
    seenMatchIds.clear()
    state.seenMatchIds.forEach((id) => seenMatchIds.add(id))
    closedDate = state.closedDate
    currentDate = state.currentDate
    previousSession = state.previousSession
    orderSequence = state.orderSequence
    eventSequence = state.eventSequence
    matchSequence = state.matchSequence
    coreSequence = state.coreSequence
  }

  return {
    onMarketTick,
    applyExecution,
    createOrder,
    pauseOrder,
    resumeOrder,
    cancelOrder,
    updateOrder,
    repriceOrder,
    getRepriceFields,
    markChildUnknown,
    reconcileUnknownChild,
    load,
    exportState,
    importState,
    listOrders: () => parents,
    getOrder: requireParent,
    getChildren: (parentOrderId: string) => children.filter((child) => child.parent_order_id === parentOrderId),
    getConditions: (parentOrderId: string) => conditions.filter((item) => item.parent_order_id === parentOrderId),
    getExecutions: (parentOrderId: string) => executions.filter((item) => item.parent_order_id === parentOrderId),
    getEvents: (parentOrderId: string) => events.filter((event) => event.parent_order_id === parentOrderId),
    getNotifications: (parentOrderId: string) =>
      notifications.filter((item) => item.parent_order_id === parentOrderId),
    getSnapshot: (parentOrderId: string) => snapshots.get(parentOrderId),
    getWorkingQty: (parentOrderId: string) => workingOf(requireParent(parentOrderId)),
    getAllowedQty: (parentOrderId: string) => allowedOf(requireParent(parentOrderId)),
  }
}

export type OrderEngine = ReturnType<typeof createOrderEngine>
