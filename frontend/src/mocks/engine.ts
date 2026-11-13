import { QTY_LOT_SIZE } from '@/config/hose'
import { PARENT_STATUS_STYLES } from '@/config/orderStatus'
import { STRATEGIES } from '@/config/strategies'
import { DEFAULT_ORDER_RULES, SYSTEM_PARAM_DEFAULTS } from '@/config/systemParams'
import { formatClock, toDateString } from '@/lib/format'
import { fromCreateOrderRequest, validateOrderRules, validateOrderValues } from '@/pages/PlaceOrder/orderSchema'
import type {
  ChildOrder,
  ChildOrderStatus,
  ChildOrderType,
  CreateOrderRequest,
  Execution,
  FillDetail,
  MarketSnapshot,
  KillSwitchRequest,
  KillSwitchState,
  MarketState,
  MarketTrade,
  Notification,
  NotificationType,
  OpsAlert,
  OpsOverview,
  OrderRules,
  OrderCondition,
  OrderEvent,
  OrderEventAction,
  OrderPriceField,
  OrderReasonCode,
  ParentOrder,
  ParentOrderStatus,
  PendingFault,
  PriceFieldName,
  RepriceOrderRequest,
  Side,
  StrategyParameter,
  SessionCode,
  SymbolQuote,
  SystemParameterCode,
  SystemParameterValues,
  UpdateOrderRequest,
} from '@/types'
import { formatDate, formatNumber } from '@/lib/format'
import { isAuctionSession, parseTimeToSeconds, validatePrice } from '@/utils/hose'
import {
  getAllowedActions,
  getReopenBlock,
  isRepriceRequired,
  isTerminalStatus,
  type OrderAction,
} from '@/utils/orderActions'
import { getTwapTarget, getVwapTarget } from '@/utils/schedule'
import { countLevelsInLimit, planHuntSweep } from '@/utils/huntSweep'
import { type BookSide, getBookLevels, oppositeBookSide } from './depth'

/** Một lần lệnh của OMS lấy thanh khoản ở một mức của sổ lệnh; runtime trừ KL này khỏi sổ lệnh của bộ giả lập. */
export interface DepthTake {
  symbol: string
  side: BookSide
  price: number
  qty: number
}

const LOT = QTY_LOT_SIZE
const SECONDS_PER_DAY = 86_400
/** Mỗi nhịp, một lệnh con khớp tối đa từng này lô, để thấy khớp dần. */
const MAX_FILL_LOTS_PER_TICK = 5
/**
 * Child UNKNOWN do mất ACK được đối soát sau từng này nhịp, tức khoảng 5 giây thật ở mọi tốc độ.
 * Cố định vì đây là thời gian giả lập việc tra Core, không phải tham số vận hành.
 * Các ngưỡng vận hành (số lần từ chối, độ trễ giá, thời gian chờ ACK) lấy từ cấu hình hệ thống.
 */
const RECOVERY_TICKS = 5

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
  /** Tick khớp thị trường mẫu cho báo cáo hiệu quả. Engine không dùng, runtime nạp vào băng tick. */
  tape?: MarketTrade[]
}

/** Nơi engine đọc tham số hệ thống. Đọc lại ở mỗi quyết định, nên giá trị vừa duyệt có hiệu lực ngay nhịp sau. */
export interface EngineConfig {
  getValue: <Code extends SystemParameterCode>(code: Code) => SystemParameterValues[Code]
  getOrderRules: () => OrderRules
}

const DEFAULT_CONFIG: EngineConfig = {
  getValue: (code) => SYSTEM_PARAM_DEFAULTS[code],
  getOrderRules: () => DEFAULT_ORDER_RULES,
}

interface EngineOptions {
  /** Truyền hàm random có seed khi test để kết quả lặp lại được. */
  random?: () => number
  /** Không truyền thì dùng giá trị mặc định của tham số hệ thống. */
  config?: EngineConfig
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
  /** Số lệnh con liên tiếp bị Core từ chối. */
  rejectStreak: number
  /** HUNT có `max_levels`: đã quét sổ lệnh xong. Trường tùy chọn để bản lưu cũ vẫn đọc được. */
  huntSwept?: boolean
  /** HUNT: các lệnh con quét sổ lệnh, khớp theo KL của mức giá thay vì theo giá khớp gần nhất. */
  sweepChildIds?: string[]
}

/** Lệnh con đã gửi, đang chờ ACK (SENDING). Hết thời gian chờ thì chuyển UNKNOWN. */
interface PendingAck {
  child_order_id: string
  ticksLeft: number
  core_received: boolean
}

/** Child UNKNOWN đang chờ đối soát tự động. */
interface PendingRecovery {
  child_order_id: string
  ticksLeft: number
  core_received: boolean
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
  pendingFaults: PendingFault[]
  pendingAcks: PendingAck[]
  pendingRecoveries: PendingRecovery[]
  killSwitch: KillSwitchState
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

/** Đã gửi mà chưa rõ Core có giữ lệnh không (đang chờ ACK, hoặc đã mất phản hồi): không tự hủy hay cho hết hạn. */
function isAwaitingCore(child: ChildOrder) {
  return child.status === 'SENDING' || child.status === 'UNKNOWN'
}

/** Điều kiện đã chạm giá chưa. Với Bracket, `side` là chiều của lệnh thoát. */
export function isConditionHit(conditionType: string, side: Side, lastPrice: number, triggerPrice: number) {
  const hitsWhenRising = conditionType === 'STOP' || conditionType === 'TRAILING_STOP' ? side === 'BUY' : side === 'SELL'
  return hitsWhenRising ? lastPrice >= triggerPrice : lastPrice <= triggerPrice
}

export function createOrderEngine(options: EngineOptions = {}) {
  /** Đổi được bằng setRandom: Chế độ Demo chạy với seed cố định để kết quả lặp lại được. */
  let random = options.random ?? Math.random
  const config = options.config ?? DEFAULT_CONFIG
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
  let pendingFaults: PendingFault[] = []
  let pendingAcks: PendingAck[] = []
  let pendingRecoveries: PendingRecovery[] = []
  let killSwitch: KillSwitchState = { global: false, accounts: [] }
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
  /** KL lệnh của OMS đã lấy ở sổ lệnh, chờ runtime trừ khỏi bộ giả lập. */
  let depthTakes: DepthTake[] = []
  /** KL đã lấy ở từng mức trong nhịp hiện tại, để nhiều lệnh con cùng mức không lấy quá KL đang có. */
  const tickTakes = new Map<string, number>()

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
        rejectStreak: 0,
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
    extra?: Pick<OrderEvent, 'fill_detail' | 'reason' | 'sweep_plan' | 'template_id'>,
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
      ...extra,
    })
  }

  function setParentStatus(
    parent: ParentOrder,
    next: ParentOrderStatus,
    action: OrderEventAction,
    userId?: string,
    reason?: string,
  ) {
    const previous = parent.status
    parent.status = next
    parent.updated_at = nowIso()
    logEvent(parent.parent_order_id, null, action, previous, next, userId, reason ? { reason } : undefined)
  }

  function setChildStatus(
    child: ChildOrder,
    next: ChildOrderStatus,
    action: OrderEventAction,
    userId?: string,
    fillDetail?: FillDetail,
  ) {
    const previous = child.status
    child.status = next
    logEvent(child.parent_order_id, child.child_order_id, action, previous, next, userId, fillDetail && { fill_detail: fillDetail })
  }

  function notify(parentOrderId: string, type: NotificationType, message: string) {
    notifications.push({ notification_type: type, parent_order_id: parentOrderId, message, sent_at: nowIso() })
  }

  /** Hệ thống tạm dừng lệnh: hủy lệnh con đang chờ (Child UNKNOWN giữ nguyên), ghi event và báo lý do. */
  function pauseBySystem(parent: ParentOrder, reason: OrderReasonCode, message: string, userId?: string) {
    cancelOpenChildren(parent, userId)
    parent.reason_code = reason
    // Chỉ lệnh dừng vì giá trễ mới tự chạy lại. Lệnh khác không còn gửi lệnh con, lỗi đang chờ sẽ treo mãi.
    if (reason !== 'MARKET_DATA_STALE') {
      pendingFaults = pendingFaults.filter((fault) => fault.parent_order_id !== parent.parent_order_id)
    }
    setParentStatus(parent, 'PAUSED_SYSTEM', 'PAUSE', userId)
    notify(parent.parent_order_id, 'PARENT_PAUSED', `Lệnh ${parent.parent_order_id} tạm dừng: ${message}`)
  }

  /** Sinh lệnh con; trả về mã lệnh con, hoặc undefined nếu KL không dương. */
  function createChild(
    parent: ParentOrder,
    side: Side,
    orderType: ChildOrderType,
    price: number | null,
    quantity: number,
  ): string | undefined {
    if (quantity <= 0) return undefined
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
    return childId
  }

  /** Hủy lệnh con đang chờ. Child SENDING, UNKNOWN giữ nguyên vì chưa biết Core đang giữ gì. */
  function cancelOpenChildren(parent: ParentOrder, userId?: string) {
    for (const child of childrenOf(parent)) {
      if (isChildLive(child.status) && !isAwaitingCore(child)) {
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
      setChildStatus(child, 'EXPIRED', isAwaitingCore(child) ? 'RECOVERY' : 'DECISION')
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
    const child = children.find((item) => item.child_order_id === report.child_order_id)
    if (!child) return false
    const parent = requireParent(child.parent_order_id)
    if (seenMatchIds.has(report.exchange_match_id)) {
      logEvent(parent.parent_order_id, child.child_order_id, 'DECISION', `DUPLICATE_FILL:${report.exchange_match_id}`, 'IGNORED')
      notify(
        parent.parent_order_id,
        'DUPLICATE_FILL_IGNORED',
        `Bỏ qua báo khớp trùng ${report.exchange_match_id} của lệnh ${parent.parent_order_id}, khối lượng không đổi.`,
      )
      return false
    }
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
    setChildStatus(child, child.filled_qty >= child.quantity ? 'FILLED' : 'PARTIAL_FILLED', 'FILL', undefined, {
      qty,
      price: report.price,
      exchange_match_id: report.exchange_match_id,
    })

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
      child.sent_at = nowIso()
      const fault = takePendingFault(parent)
      if (fault?.type === 'REJECT') rejectChild(parent, child)
      else if (fault) awaitAck(child, fault.type === 'TIMEOUT_AFTER_CORE')
      else acknowledgeChild(parent, child, 'CHILD_SEND')
    }
  }

  function acknowledgeChild(parent: ParentOrder, child: ChildOrder, action: OrderEventAction, userId?: string) {
    coreSequence += 1
    child.core_order_id = `CORE-${String(coreSequence).padStart(6, '0')}`
    runtimeOf(parent).rejectStreak = 0
    setChildStatus(child, 'ACKNOWLEDGED', action, userId)
  }

  function takePendingFault(parent: ParentOrder) {
    const index = pendingFaults.findIndex((fault) => fault.parent_order_id === parent.parent_order_id)
    return index === -1 ? undefined : pendingFaults.splice(index, 1)[0]
  }

  /** Core từ chối: lệnh con kết thúc nên lệnh cha sinh lại ở nhịp sau, nhưng lặp lại thì phải dừng. */
  function rejectChild(parent: ParentOrder, child: ChildOrder) {
    setChildStatus(child, 'REJECTED', 'REJECT')
    notify(
      parent.parent_order_id,
      'CHILD_REJECTED',
      `Core từ chối lệnh con chu kỳ ${child.cycle_no} của lệnh ${parent.parent_order_id}.`,
    )
    const runtime = runtimeOf(parent)
    runtime.rejectStreak += 1
    if (runtime.rejectStreak >= config.getValue('MAX_CONSECUTIVE_REJECTS')) {
      pauseBySystem(parent, 'CHILD_REJECTED_REPEAT', `Core từ chối ${runtime.rejectStreak} lệnh con liên tiếp.`)
    }
  }

  /** Đã gửi nhưng chưa có ACK: chờ đúng ACK_TIMEOUT_SECONDS nhịp (giây thật) rồi mới coi là mất phản hồi. */
  function awaitAck(child: ChildOrder, coreReceived: boolean) {
    setChildStatus(child, 'SENDING', 'CHILD_SEND')
    pendingAcks.push({
      child_order_id: child.child_order_id,
      ticksLeft: config.getValue('ACK_TIMEOUT_SECONDS'),
      core_received: coreReceived,
    })
  }

  /** Đếm lùi thời gian chờ ACK. Lệnh con đã rời SENDING (bị hủy, hết hạn) thì bỏ khỏi danh sách. */
  function processAcks() {
    pendingAcks = pendingAcks.filter((item) => {
      const child = children.find((entry) => entry.child_order_id === item.child_order_id)
      if (child?.status !== 'SENDING') return false
      item.ticksLeft -= 1
      if (item.ticksLeft > 0) return true
      timeOutChild(requireParent(child.parent_order_id), child, item.core_received)
      return false
    })
  }

  /** Timeout: chưa biết Core đã tạo lệnh hay chưa, nên vẫn tính là working để không gửi trùng. */
  function timeOutChild(parent: ParentOrder, child: ChildOrder, coreReceived: boolean) {
    setChildStatus(child, 'UNKNOWN', 'CHILD_UNKNOWN')
    pendingRecoveries.push({
      child_order_id: child.child_order_id,
      ticksLeft: RECOVERY_TICKS,
      core_received: coreReceived,
    })
    notify(
      parent.parent_order_id,
      'CHILD_UNKNOWN',
      `Mất phản hồi từ Core với lệnh con chu kỳ ${child.cycle_no} của lệnh ${parent.parent_order_id}, đang chờ đối soát.`,
    )
  }

  function processRecoveries() {
    pendingRecoveries = pendingRecoveries.filter((item) => {
      item.ticksLeft -= 1
      if (item.ticksLeft > 0) return true
      recoverChild(item)
      return false
    })
  }

  /**
   * Đối soát ra trạng thái thật. Core đã nhận thì vẫn là lệnh con đó, không gửi lại.
   * Core chưa nhận, hoặc lệnh cha đã ngừng chạy, thì hủy để giải phóng phần KL.
   */
  function recoverChild(item: Pick<PendingRecovery, 'child_order_id' | 'core_received'>, userId?: string) {
    const child = children.find((entry) => entry.child_order_id === item.child_order_id)
    if (child?.status !== 'UNKNOWN') return
    const parent = requireParent(child.parent_order_id)
    const isKept = item.core_received && isRunning(parent)
    if (isKept) acknowledgeChild(parent, child, 'RECOVERY', userId)
    else reconcileUnknownChild(child.child_order_id, userId)
    notify(
      parent.parent_order_id,
      'CHILD_RECOVERED',
      `Đối soát xong lệnh con chu kỳ ${child.cycle_no} của lệnh ${parent.parent_order_id}: ${
        isKept ? 'Core đã nhận lệnh, không gửi lại.' : 'lệnh không còn hiệu lực trên Core, đã hủy.'
      }`,
    )
  }

  /** Giá trễ thì lệnh đang chạy phải dừng, vì quyết định theo giá cũ. Có giá mới thì chỉ chạy lại lệnh dừng vì lý do này. */
  function checkMarketData(state: MarketState) {
    const isStale = isQuoteStale(state.quote_age_seconds)
    for (const parent of parents) {
      if (isStale && isRunning(parent)) {
        pauseBySystem(parent, 'MARKET_DATA_STALE', 'dữ liệu giá thị trường bị trễ.')
      } else if (!isStale && parent.status === 'PAUSED_SYSTEM' && parent.reason_code === 'MARKET_DATA_STALE') {
        const runtime = runtimeOf(parent)
        runtime.lastVolume = null // Không tính bù KL của POV trong lúc tạm dừng.
        runtime.povAccumulated = 0
        parent.reason_code = null
        setParentStatus(parent, parent.executed_qty > 0 ? 'PARTIALLY_EXECUTED' : 'ACTIVE', 'RESUME')
        notify(parent.parent_order_id, 'PARENT_RESUMED', `Lệnh ${parent.parent_order_id} chạy lại: đã có giá mới.`)
        settleParent(parent)
      }
    }
  }

  function isQuoteStale(quoteAgeSeconds: number) {
    return quoteAgeSeconds >= config.getValue('MAX_DATA_DELAY_SECONDS')
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

  /**
   * Lệnh con quét của HUNT lấy thanh khoản ngay tại mức giá của nó trong sổ lệnh, tối đa KL đang có ở mức đó
   * (trừ phần lệnh khác đã lấy trong nhịp này). Mức không còn trong sổ lệnh thì chờ như một lệnh LO.
   */
  function fillSweepChild(parent: ParentOrder, child: ChildOrder, quote: SymbolQuote) {
    if (!quote.depth || child.price === null) return
    const side = oppositeBookSide(child.side)
    const level = quote.depth[side].find((item) => item.price === child.price)
    if (!level) return
    const key = `${quote.symbol}|${side}|${level.price}`
    const available = level.qty - (tickTakes.get(key) ?? 0)
    const qty = Math.min(child.quantity - child.filled_qty, available)
    if (qty <= 0) return
    const before = child.filled_qty
    fillChild(child, level.price, qty)
    const taken = child.filled_qty - before
    if (taken <= 0) return
    tickTakes.set(key, (tickTakes.get(key) ?? 0) + taken)
    depthTakes.push({ symbol: parent.symbol, side, price: level.price, qty: taken })
  }

  /** Phiên liên tục: khớp dần từng phần. */
  function fillChildren(parent: ParentOrder, quote: SymbolQuote) {
    const sweepIds = quote.depth ? runtimeOf(parent).sweepChildIds : undefined
    for (const child of getOpenChildren(parent)) {
      if (sweepIds?.includes(child.child_order_id)) {
        fillSweepChild(parent, child, quote)
        continue
      }
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
    // Stop Limit có KL mỗi phần (tham số tùy chọn): kích hoạt xong thì chia như Iceberg, mỗi lần một phần.
    const slice = parent.strategy_type === 'STOP_LIMIT' ? getNumberParam(parent, 'slice_qty') : 0
    if (slice > 0) {
      if (workingOf(parent) === 0) createChild(parent, parent.side, spec.type, spec.price, Math.min(slice, allowedOf(parent)))
      return
    }
    createChild(parent, parent.side, spec.type, spec.price, allowedOf(parent))
  }

  /** HUNT có `max_levels`: quét sổ lệnh khi giá về mức săn, rồi xử lý phần còn lại theo `remainder_passive`. */
  function isSweepHunt(parent: ParentOrder) {
    return parent.strategy_type === 'HUNT' && getNumberParam(parent, 'max_levels') > 0
  }

  /**
   * Quét tối đa `max_levels` mức phía đối ứng, chỉ các mức không vượt giá giới hạn (giá tối đa khi mua).
   * Mỗi mức một lệnh con LO đúng giá mức đó. Chưa có mức nào hợp lệ thì chờ nhịp sau, tới hạn `max_wait_min`.
   * Quét xong, phần còn lại: `remainder_passive` = 1 đặt bị động tại giá tốt nhất cùng phía, 0 thì kết thúc lệnh.
   */
  function stepHuntSweep(parent: ParentOrder, quote: SymbolQuote) {
    checkConditions(parent, parent.side, quote.last_price)
    if (!getTriggeredCondition(parent)) return
    const runtime = runtimeOf(parent)

    if (!runtime.huntSwept) {
      const plan = planHuntSweep({
        side: parent.side,
        levels: getBookLevels(quote, parent.side),
        qty: allowedOf(parent),
        limitPrice: parent.limit_price,
        maxLevels: getNumberParam(parent, 'max_levels'),
        remainderPolicy: getNumberParam(parent, 'remainder_passive') === 1 ? 'WAIT' : 'CANCEL',
      })
      const inLimit = plan.steps.filter((step) => step.status !== 'OUT_OF_LIMIT')
      if (inLimit.length === 0) return
      const sweepChildIds: string[] = []
      for (const step of plan.steps) {
        if (step.status !== 'TAKE') continue
        const created = createChild(parent, parent.side, 'LO', step.price, step.take)
        if (created) {
          step.child_order_id = created
          sweepChildIds.push(created)
        }
      }
      runtime.huntSwept = true
      runtime.sweepChildIds = sweepChildIds
      if (quote.depth) plan.book = { bids: quote.depth.bids.map(({ price, qty }) => ({ price, qty })), asks: quote.depth.asks.map(({ price, qty }) => ({ price, qty })) }
      logEvent(
        parent.parent_order_id,
        null,
        'DECISION',
        `HUNT_SWEEP:${countLevelsInLimit(plan)}`,
        `LEVELS:${inLimit.map((step) => step.price).join(',')}`,
        'SYSTEM',
        { sweep_plan: plan },
      )
      return
    }

    // Chờ các lệnh con quét khớp xong rồi mới xử lý phần còn lại.
    if (workingOf(parent) > 0 || allowedOf(parent) <= 0) return
    if (getNumberParam(parent, 'remainder_passive') !== 1) {
      expireParent(parent)
      return
    }
    const best = parent.side === 'BUY' ? quote.bid_price : quote.ask_price
    const price = parent.limit_price === null ? best : parent.side === 'BUY' ? Math.min(best, parent.limit_price) : Math.max(best, parent.limit_price)
    createChild(parent, parent.side, 'LO', price, allowedOf(parent))
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
        stepConditional(parent, last)
        break
      case 'HUNT':
        if (isSweepHunt(parent)) stepHuntSweep(parent, quote)
        else stepConditional(parent, last)
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
    } else if (
      parent.strategy_type === 'HUNT' &&
      // HUNT quét sổ lệnh: đã chạm giá săn nhưng chưa có mức hợp lệ để quét thì vẫn trong thời gian săn.
      (runtimeOf(parent).triggeredConditionId === null || (isSweepHunt(parent) && !runtimeOf(parent).huntSwept))
    ) {
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

    // Lệnh con không qua được ngày mới. Child SENDING, UNKNOWN giữ nguyên vì chưa đối soát xong.
    for (const child of childrenOf(parent)) {
      if (isChildLive(child.status) && !isAwaitingCore(child)) setChildStatus(child, 'EXPIRED', 'DECISION')
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
    tickTakes.clear()
    // Ba việc này phải chạy cả khi đồng hồ đứng yên (đã tới 15:00), nếu không lệnh sẽ kẹt mãi.
    // Đối soát trước, chờ ACK sau: Child vừa sang UNKNOWN ở nhịp này bắt đầu đếm đối soát từ nhịp sau.
    processRecoveries()
    processAcks()
    checkMarketData(state)
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

  /** Lệnh đang hủy mà còn Child SENDING, UNKNOWN: đối soát ngay ở nhịp sau để lệnh không bị kẹt mãi. */
  function reconcilePendingCancel(parent: ParentOrder) {
    for (const child of childrenOf(parent)) {
      if (isAwaitingCore(child)) setChildStatus(child, 'CANCELLED', 'RECOVERY')
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
    if (isKillSwitched(request.account_no)) {
      throw new EngineError('Tài khoản đang bị dừng bởi kill switch, chưa đặt được lệnh mới')
    }
    // Luật đặt lệnh của cấu hình hệ thống chỉ áp cho lệnh mới; lệnh đang chạy giữ tham số lúc đặt.
    const ruleErrors = validateOrderRules(fromCreateOrderRequest(request), config.getOrderRules())
    if (ruleErrors.length > 0) throw new EngineError(ruleErrors[0].message, 422)
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
      ...(request.template_id ? { template_id: request.template_id } : {}),
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
    logEvent(parentOrderId, null, 'CREATE', null, 'ACTIVE', userId, request.template_id ? { template_id: request.template_id } : undefined)
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
  /**
   * Core hủy phần chưa khớp của lệnh con (ví dụ hết hiệu lực trên sàn). Phần đã khớp giữ nguyên,
   * lệnh cha sinh lệnh con kế tiếp theo KL đã khớp thật ở nhịp sau (TC-E2E-051).
   */
  function cancelChildByCore(childOrderId: string) {
    const child = children.find((item) => item.child_order_id === childOrderId)
    if (!child || !isChildLive(child.status) || isAwaitingCore(child)) {
      throw new EngineError('Không tìm thấy lệnh con đang chờ khớp trên Core', 404)
    }
    setChildStatus(child, 'CANCELLED', 'CANCEL')
    settleParent(requireParent(child.parent_order_id))
    return child
  }

  /** Đối soát xong: phần chưa khớp của Child UNKNOWN được giải phóng để sinh lại. */
  function reconcileUnknownChild(childOrderId: string, userId?: string) {
    const child = children.find((item) => item.child_order_id === childOrderId)
    if (!child || child.status !== 'UNKNOWN') throw new EngineError('Không tìm thấy lệnh con UNKNOWN', 404)
    setChildStatus(child, 'CANCELLED', 'RECOVERY', userId)
    settleParent(requireParent(child.parent_order_id))
  }

  /**
   * Vận hành đối soát ngay, không chờ hết thời gian. Child đang chờ đối soát tự động thì theo kết cục đã định;
   * Child khác (lệnh mẫu) coi là Core đã nhận khi có core_order_id.
   */
  function reconcileChildNow(childOrderId: string, userId: string) {
    const child = children.find((item) => item.child_order_id === childOrderId)
    if (child?.status !== 'UNKNOWN') throw new EngineError('Lệnh con này không còn ở trạng thái UNKNOWN', 404)
    const pending = pendingRecoveries.find((item) => item.child_order_id === childOrderId)
    pendingRecoveries = pendingRecoveries.filter((item) => item !== pending)
    recoverChild({ child_order_id: childOrderId, core_received: pending?.core_received ?? child.core_order_id !== null }, userId)
    return child
  }

  /** Vận hành mở lại lệnh PAUSED_SYSTEM: bắt buộc có lý do, ghi RESUME kèm người thao tác và lý do. */
  function reopenOrder(parentOrderId: string, reason: string, userId: string) {
    const parent = requireParent(parentOrderId)
    if (parent.status !== 'PAUSED_SYSTEM') throw new EngineError('Chỉ mở lại được lệnh đang bị hệ thống tạm dừng')
    const trimmed = reason.trim()
    if (trimmed === '') throw new EngineError('Phải nhập lý do mở lại', 422)
    const isStale = isQuoteStale(market?.quote_age_seconds ?? 0)
    const block = getReopenBlock(parent.reason_code, isKillSwitched(parent.account_no), isStale)
    if (block) throw new EngineError(block)

    const runtime = runtimeOf(parent)
    runtime.lastVolume = null // Không tính bù KL của POV trong lúc tạm dừng.
    runtime.povAccumulated = 0
    runtime.rejectStreak = 0
    parent.reason_code = null
    setParentStatus(parent, parent.executed_qty > 0 ? 'PARTIALLY_EXECUTED' : 'ACTIVE', 'RESUME', userId, trimmed)
    notify(parentOrderId, 'PARENT_RESUMED', `Lệnh ${parentOrderId} được ${userId} mở lại. Lý do: ${trimmed}`)
    settleParent(parent)
    return parent
  }

  function requireRunning(parentOrderId: string) {
    const parent = requireParent(parentOrderId)
    if (!isRunning(parent)) throw new EngineError('Chỉ bơm được lỗi này vào lệnh đang chạy', 422)
    return parent
  }

  function injectRejectNext(parentOrderId: string) {
    const parent = requireRunning(parentOrderId)
    pendingFaults.push({ parent_order_id: parentOrderId, type: 'REJECT' })
    return parent
  }

  /** TC-E2E-140: timeout trước khi Core tạo lệnh. TC-E2E-141: timeout nhưng Core đã tạo lệnh. */
  function injectTimeout(parentOrderId: string, type: 'TIMEOUT_BEFORE_CORE' | 'TIMEOUT_AFTER_CORE') {
    const parent = requireRunning(parentOrderId)
    pendingFaults.push({ parent_order_id: parentOrderId, type })
    return parent
  }

  /** Phát lại đúng báo khớp cuối cùng của lệnh. */
  function injectDuplicateFill(parentOrderId: string) {
    const parent = requireParent(parentOrderId)
    const last = executions.filter((item) => item.parent_order_id === parentOrderId).at(-1)
    if (!last) throw new EngineError('Lệnh này chưa có lần khớp nào để báo trùng', 422)
    applyExecution({
      child_order_id: last.child_order_id,
      exchange_match_id: last.exchange_match_id,
      price: last.price,
      qty: last.qty,
    })
    return parent
  }

  // ===== Kill switch =====

  function isKillSwitched(accountNo: string) {
    return killSwitch.global || killSwitch.accounts.includes(accountNo)
  }

  /**
   * Dừng khẩn cấp: mọi lệnh chưa kết thúc trong phạm vi chuyển PAUSED_SYSTEM và hủy lệnh con chưa khớp.
   * Cố ý không kiểm tra phiên: đây là thao tác khẩn cấp nên được hủy cả trong ATO, ATC.
   */
  function activateKillSwitch(request: KillSwitchRequest, userId: string) {
    const label = request.scope === 'ALL' ? 'ALL' : `ACCOUNT:${request.account_no}`
    if (request.scope === 'ALL') killSwitch.global = true
    else if (!killSwitch.accounts.includes(request.account_no)) killSwitch.accounts.push(request.account_no)

    for (const parent of parents) {
      if (isTerminalStatus(parent.status) || parent.status === 'CANCEL_PENDING') continue
      if (parent.reason_code === 'KILL_SWITCH' || !isKillSwitched(parent.account_no)) continue
      logEvent(parent.parent_order_id, null, 'DECISION', null, `KILL_SWITCH:${label}`, userId)
      pauseBySystem(parent, 'KILL_SWITCH', 'vận hành đã kích hoạt kill switch.', userId)
    }
    return killSwitch
  }

  /** Chỉ cho đặt lệnh mới trở lại. Lệnh đã dừng giữ nguyên, để không có lệnh nào tự gửi lại ra sàn. */
  function releaseKillSwitch(request: KillSwitchRequest) {
    if (request.scope === 'ALL') killSwitch.global = false
    else killSwitch.accounts = killSwitch.accounts.filter((account) => account !== request.account_no)
    return killSwitch
  }

  // ===== Màn vận hành =====

  function getOpsAlerts(isStale: boolean): OpsAlert[] {
    const alerts: OpsAlert[] = []
    if (isStale) {
      alerts.push({
        alert_id: 'MARKET_DATA_STALE',
        type: 'MARKET_DATA_STALE',
        parent_order_id: null,
        child_order_id: null,
        message: `Dữ liệu giá trễ ${formatNumber(market?.quote_age_seconds ?? 0)} giây.`,
        time: nowIso(),
      })
    }
    for (const parent of parents) {
      if (parent.status === 'PAUSED_SYSTEM') {
        const reason = notifications
          .filter((item) => item.parent_order_id === parent.parent_order_id && item.notification_type === 'PARENT_PAUSED')
          .at(-1)?.message
        alerts.push({
          alert_id: `PAUSED-${parent.parent_order_id}`,
          type: 'PARENT_PAUSED_SYSTEM',
          parent_order_id: parent.parent_order_id,
          child_order_id: null,
          message: reason ?? `Lệnh ${parent.parent_order_id} đang bị hệ thống tạm dừng.`,
          time: parent.updated_at,
        })
      }
      if (isTerminalStatus(parent.status)) continue
      for (const child of childrenOf(parent)) {
        if (child.status !== 'UNKNOWN' && child.status !== 'REJECTED') continue
        const isUnknown = child.status === 'UNKNOWN'
        alerts.push({
          alert_id: child.child_order_id,
          type: isUnknown ? 'CHILD_UNKNOWN' : 'CHILD_REJECTED',
          parent_order_id: parent.parent_order_id,
          child_order_id: child.child_order_id,
          message: `${parent.symbol}: lệnh con chu kỳ ${child.cycle_no} ${isUnknown ? 'mất phản hồi từ Core' : 'bị Core từ chối'}.`,
          time: child.sent_at ?? child.created_at,
        })
      }
    }
    return alerts.sort((a, b) => b.time.localeCompare(a.time))
  }

  function getOpsOverview(): Omit<OpsOverview, 'feed_fault_active'> {
    const status_counts = Object.fromEntries(
      (Object.keys(PARENT_STATUS_STYLES) as ParentOrderStatus[]).map((status) => [
        status,
        parents.filter((parent) => parent.status === status).length,
      ]),
    ) as Record<ParentOrderStatus, number>
    const quoteAge = market?.quote_age_seconds ?? 0
    const isStale = isQuoteStale(quoteAge)
    return {
      status_counts,
      child_unknown: children.filter((child) => child.status === 'UNKNOWN').length,
      child_rejected: children.filter((child) => child.status === 'REJECTED').length,
      quote_age_seconds: quoteAge,
      is_feed_stale: isStale,
      alerts: getOpsAlerts(isStale),
      pending_faults: pendingFaults.filter((fault) => !isTerminalStatus(requireParent(fault.parent_order_id).status)),
      kill_switch: killSwitch,
      accounts: [...new Set(parents.map((parent) => parent.account_no))].sort(),
    }
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
    pendingFaults = []
    pendingAcks = []
    pendingRecoveries = []
    killSwitch = { global: false, accounts: [] }
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
      pendingFaults,
      pendingAcks,
      pendingRecoveries,
      killSwitch,
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
    pendingFaults = state.pendingFaults
    pendingAcks = state.pendingAcks
    pendingRecoveries = state.pendingRecoveries
    killSwitch = state.killSwitch
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
    /** Lấy và xóa các lần lệnh của OMS lấy thanh khoản ở sổ lệnh từ sau lần gọi trước. */
    drainDepthTakes: () => {
      const taken = depthTakes
      depthTakes = []
      return taken
    },
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
    reconcileChildNow,
    reopenOrder,
    injectRejectNext,
    injectTimeout,
    injectDuplicateFill,
    cancelChildByCore,
    /** Đổi hàm random (Chế độ Demo dùng seed cố định, thoát Demo thì trả lại Math.random). */
    setRandom: (next: () => number) => {
      random = next
    },
    activateKillSwitch,
    releaseKillSwitch,
    getOpsOverview,
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
    /** Toàn bộ lệnh con, lần khớp, event (theo thứ tự xảy ra): cho Trung tâm lệnh. */
    listChildren: () => children,
    listExecutions: () => executions,
    listEvents: () => events,
    getParameters: (parentOrderId: string) => parameters.get(parentOrderId) ?? [],
    getWorkingQty: (parentOrderId: string) => workingOf(requireParent(parentOrderId)),
    getAllowedQty: (parentOrderId: string) => allowedOf(requireParent(parentOrderId)),
  }
}

export type OrderEngine = ReturnType<typeof createOrderEngine>
