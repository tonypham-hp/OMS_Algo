import type { EngineState } from '@/mocks/engine'
import type { CreateOrderRequest, StrategyParameter } from '@/types'
import { parseTimeToSeconds } from '@/utils/hose'
import { createEmptySeed } from './env'
import { childrenOfRef, findChild, readState, requireChild, requireOrderId } from './state'
import type { ChildRef, DemoAction, DemoContext, DemoEnv, PlaceOrderParams } from './types'

// Mỗi loại action là một hàm gọi vào engine, bộ giả lập: không có logic nghiệp vụ ở đây,
// mọi quyết định (sinh lệnh con, chặn KL, đối soát) vẫn do engine làm như khi chạy thật.

/** Tham số dạng hh:mm là TIME, còn lại là INTEGER. */
function toParameters(parameters: PlaceOrderParams['parameters']): StrategyParameter[] {
  return Object.entries(parameters).map(([code, value]) => ({
    parameter_code: code,
    parameter_value: String(value),
    data_type: typeof value === 'string' && /^\d{2}:\d{2}$/.test(value) ? 'TIME' : 'INTEGER',
  }))
}

function placeOrder(env: DemoEnv, ctx: DemoContext, params: PlaceOrderParams) {
  const request: CreateOrderRequest = {
    client_request_id: `demo-${params.ref}-${Object.keys(ctx.refs).length + 1}`,
    account_no: env.account,
    symbol: params.symbol,
    side: params.side,
    total_qty: params.total_qty,
    limit_price: params.limit_price,
    strategy_type: params.strategy_type,
    persistence_mode: 'DAY',
    valid_to: null,
    parameters: toParameters(params.parameters),
  }
  ctx.refs[params.ref] = env.engine.createOrder(request, env.userId).parent_order_id
}

function nextMatchId(ctx: DemoContext) {
  ctx.matchSequence += 1
  return `DEMO-M-${String(ctx.matchSequence).padStart(4, '0')}`
}

/** Core báo khớp lệnh con: mặc định khớp hết phần còn lại tại giá của lệnh con. */
function coreFill(env: DemoEnv, ctx: DemoContext, ref: ChildRef, qty?: number, price?: number) {
  const child = requireChild(readState(env, ctx), ref)
  const quote = env.simulator.getState().quotes.find((item) => item.symbol === env.engine.getOrder(child.parent_order_id).symbol)
  env.engine.applyExecution({
    child_order_id: child.child_order_id,
    exchange_match_id: nextMatchId(ctx),
    price: price ?? child.price ?? quote?.last_price ?? 0,
    qty: qty ?? child.quantity - child.filled_qty,
  })
}

/** Khớp lần lượt từng lệnh con đang chờ; sau mỗi lần khớp tua 2 nhịp để engine sinh và gửi lệnh con kế tiếp. */
function fillUntilDone(env: DemoEnv, ctx: DemoContext, orderRef: string) {
  const id = requireOrderId(ctx, orderRef)
  for (let round = 0; round < 100; round += 1) {
    const order = env.engine.getOrder(id)
    if (order.executed_qty >= order.total_qty) return
    const open = findChild(readState(env, ctx), { order: orderRef, child: 'open' })
    if (open) coreFill(env, ctx, { order: orderRef, child: 'open' })
    env.simulator.advance(2)
  }
  throw new Error(`Lệnh "${orderRef}" chưa khớp đủ sau 100 vòng`)
}

/** Mã lệnh con theo `ref`, đọc từ dữ liệu đã ghi ra "đĩa" (lúc OMS đang tắt, bộ nhớ engine trống). */
function childFromDisk(ctx: DemoContext, ref: ChildRef) {
  if (!ctx.disk) throw new Error('OMS chưa sập, không có dữ liệu trên đĩa')
  const saved = JSON.parse(ctx.disk) as EngineState
  const child = findChild({ children: saved.children, ctx }, ref)
  if (!child) throw new Error(`Trên đĩa không có lệnh con ${String(ref.child)} của lệnh "${ref.order}"`)
  return child
}

/** Ảnh dữ liệu lệnh để so trước khi sập và sau khi khôi phục. */
export function orderDataFingerprint(env: DemoEnv) {
  return JSON.stringify({
    orders: env.engine.listOrders(),
    children: env.engine.listChildren(),
    executions: env.engine.listExecutions(),
  })
}

export function runAction(env: DemoEnv, ctx: DemoContext, action: DemoAction) {
  const { engine, simulator } = env
  switch (action.type) {
    case 'note':
      return
    case 'placeOrder':
      return placeOrder(env, ctx, action.params)
    case 'trade': {
      const { symbol, price, qty, repeat = 1, everySeconds = 1 } = action.params
      for (let index = 0; index < repeat; index += 1) {
        simulator.pushTrade(symbol, price, qty)
        simulator.advance(everySeconds)
      }
      return
    }
    case 'setDepth': {
      const toLevels = (levels: Array<[number, number]>) => levels.map(([price, qty]) => ({ price, qty }))
      simulator.setDepth(action.params.symbol, { asks: toLevels(action.params.asks), bids: toLevels(action.params.bids) })
      return
    }
    case 'advance':
      return simulator.advance(action.params.seconds)
    case 'jumpTo': {
      const seconds = parseTimeToSeconds(action.params.time)
      if (seconds === null) throw new Error(`Giờ không hợp lệ: ${action.params.time}`)
      return simulator.jumpTo(seconds)
    }
    case 'injectTimeout':
      engine.injectTimeout(requireOrderId(ctx, action.params.order), action.params.afterCore ? 'TIMEOUT_AFTER_CORE' : 'TIMEOUT_BEFORE_CORE')
      return
    case 'injectReject':
      engine.injectRejectNext(requireOrderId(ctx, action.params.order))
      return
    case 'duplicateFill':
      engine.injectDuplicateFill(requireOrderId(ctx, action.params.order))
      return
    case 'staleFeed':
      return simulator.setFeedStale(action.params.on)
    case 'reconcileNow':
      engine.reconcileChildNow(requireChild(readState(env, ctx), action.params).child_order_id, env.userId)
      return
    case 'coreFill':
      return coreFill(env, ctx, action.params, action.params.qty, action.params.price)
    case 'coreCancelChild':
      engine.cancelChildByCore(requireChild(readState(env, ctx), action.params).child_order_id)
      return
    case 'fillUntilDone':
      return fillUntilDone(env, ctx, action.params.order)
    case 'fillOpen': {
      const open = childrenOfRef(readState(env, ctx), action.params.order).filter(
        (child) => child.status === 'ACKNOWLEDGED' || child.status === 'PARTIAL_FILLED',
      )
      open.forEach((child) => coreFill(env, ctx, { order: action.params.order, child: child.cycle_no }))
      return
    }
    case 'pause':
      engine.pauseOrder(requireOrderId(ctx, action.params.order), env.userId)
      return
    case 'resume':
      engine.resumeOrder(requireOrderId(ctx, action.params.order), env.userId)
      return
    case 'cancel':
      engine.cancelOrder(requireOrderId(ctx, action.params.order), env.userId)
      return
    case 'mark':
      ctx.marks[action.params.key] = childrenOfRef(readState(env, ctx), action.params.order).length
      return
    case 'crash':
      ctx.beforeCrash = orderDataFingerprint(env)
      ctx.disk = JSON.stringify(engine.exportState())
      engine.load(createEmptySeed())
      return
    case 'coreFillWhileDown': {
      const child = childFromDisk(ctx, action.params)
      ctx.missedReports.push({
        child_order_id: child.child_order_id,
        exchange_match_id: nextMatchId(ctx),
        price: action.params.price,
        qty: action.params.qty,
      })
      return
    }
    case 'restore':
      if (!ctx.disk) throw new Error('Không có dữ liệu trên đĩa để khôi phục')
      engine.importState(JSON.parse(ctx.disk) as EngineState)
      return
    case 'replayMissedFills':
      ctx.missedReports.splice(0).forEach((report) => engine.applyExecution(report))
      return
  }
}
