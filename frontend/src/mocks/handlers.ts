import { http, HttpResponse } from 'msw/http'
import { formatClock, toDateString } from '@/lib/format'
import { fromCreateOrderRequest, validateOrderValues } from '@/pages/PlaceOrder/orderSchema'
import type { CreateOrderRequest, OrderCondition, ParentOrder, StrategyParameter } from '@/types'
import { DEMO_USERS, mockDb } from './data'
import { marketSimulator } from './simulator'

let orderSequence = 0

function nowIso() {
  const { sim_seconds: seconds } = marketSimulator.getState()
  return `${toDateString(new Date())}T${formatClock(seconds)}`
}

function getParameter(parameters: StrategyParameter[], code: string) {
  const parameter = parameters.find((item) => item.parameter_code === code)
  return parameter ? Number(parameter.parameter_value) : null
}

function buildConditions(order: ParentOrder, parameters: StrategyParameter[]): OrderCondition[] {
  const create = (
    index: number,
    conditionType: string,
    triggerPrice: number | null,
    ocoGroupId: string | null = null,
  ): OrderCondition => ({
    condition_id: `${order.parent_order_id}-C${index}`,
    parent_order_id: order.parent_order_id,
    condition_type: conditionType,
    trigger_price: triggerPrice,
    oco_group_id: ocoGroupId,
    status: 'ACTIVE',
    triggered_at: null,
  })

  switch (order.strategy_type) {
    case 'STOP':
    case 'STOP_LIMIT':
      return [create(1, 'STOP', getParameter(parameters, 'trigger_price'))]
    case 'TAKE_PROFIT':
      return [create(1, 'TAKE_PROFIT', getParameter(parameters, 'trigger_price'))]
    case 'TRAILING_STOP':
      return [create(1, 'TRAILING_STOP', null)]
    case 'HUNT':
      return [create(1, 'HUNT', getParameter(parameters, 'hunt_price'))]
    case 'OCO':
    case 'BRACKET': {
      const group = `OCO-${order.parent_order_id}`
      return [
        create(1, 'TAKE_PROFIT', getParameter(parameters, 'tp_price'), group),
        create(2, 'STOP', getParameter(parameters, 'sl_price'), group),
      ]
    }
    default:
      return []
  }
}

export const handlers = [
  http.get('*/api/auth/demo-users', () => HttpResponse.json(DEMO_USERS)),

  http.post('*/api/auth/login', async ({ request }) => {
    const { username } = (await request.json()) as { username: string }
    const user = DEMO_USERS.find((item) => item.username === username)
    if (!user) return HttpResponse.json({ message: 'Tài khoản không tồn tại' }, { status: 401 })
    return HttpResponse.json(user)
  }),

  http.post('*/api/orders', async ({ request }) => {
    const body = (await request.json()) as CreateOrderRequest
    const market = marketSimulator.getState()
    const today = toDateString(new Date())

    // Kiểm tra lại bằng đúng luật của form: giá có thể đã đổi từ lúc người dùng nhập.
    const errors = validateOrderValues(fromCreateOrderRequest(body), {
      getQuote: (symbol) => market.quotes.find((quote) => quote.symbol === symbol),
      today,
    })
    if (errors.length > 0) {
      return HttpResponse.json({ message: errors[0].message, errors }, { status: 422 })
    }

    orderSequence += 1
    const now = nowIso()
    const parentOrderId = `PO-${today.replaceAll('-', '')}-${String(orderSequence).padStart(4, '0')}`
    const order: ParentOrder = {
      parent_order_id: parentOrderId,
      client_request_id: body.client_request_id,
      account_no: body.account_no,
      symbol: body.symbol,
      side: body.side,
      total_qty: body.total_qty,
      executed_qty: 0,
      limit_price: body.limit_price,
      strategy_type: body.strategy_type,
      status: 'ACTIVE',
      valid_from: now,
      valid_to: body.valid_to ?? today,
      persistence_mode: body.persistence_mode,
      version: 1,
      created_at: now,
      updated_at: now,
    }
    const quote = market.quotes.find((item) => item.symbol === body.symbol)

    mockDb.parentOrders.push(order)
    mockDb.parameters.set(parentOrderId, body.parameters)
    mockDb.conditions.push(...buildConditions(order, body.parameters))
    if (quote) {
      mockDb.snapshots.set(parentOrderId, {
        arrival_price: quote.last_price,
        arrival_bid: quote.bid_price,
        arrival_ask: quote.ask_price,
        arrival_timestamp: now,
      })
    }
    // Mọi thay đổi trạng thái đều ghi một OrderEvent (mục 8 của spec).
    mockDb.events.push({
      event_id: `${parentOrderId}-E${mockDb.events.length + 1}`,
      parent_order_id: parentOrderId,
      child_order_id: null,
      action: 'CREATE',
      user_id: request.headers.get('X-User-Id') ?? 'unknown',
      channel: 'WEB',
      old_value: null,
      new_value: 'ACTIVE',
      event_time: now,
    })

    return HttpResponse.json({ parent_order: order }, { status: 201 })
  }),
]
