import type { JsonBodyType } from 'msw'
import { http, HttpResponse } from 'msw/http'
import { fromCreateOrderRequest, validateOrderValues } from '@/pages/PlaceOrder/orderSchema'
import type {
  CreateOrderRequest,
  DemoUser,
  FaultTargetRequest,
  KillSwitchRequest,
  Notification,
  OrderDetailData,
  OrderPriceField,
  ParentOrder,
  RepriceOrderRequest,
  UpdateOrderRequest,
} from '@/types'
import { DEMO_USERS } from './data'
import { EngineError } from './engine'
import { orderEngine } from './runtime'
import { marketSimulator } from './simulator'

function getUser(request: Request): DemoUser | undefined {
  const username = request.headers.get('X-User-Id')
  return DEMO_USERS.find((user) => user.username === username)
}

/** Khách hàng và dealer chỉ thấy tài khoản của mình, vận hành thấy tất cả. */
function canSeeOrder(user: DemoUser, order: ParentOrder) {
  return user.role === 'OPS' || user.accounts.includes(order.account_no)
}

function errorResponse(message: string, status: number) {
  return HttpResponse.json({ message }, { status })
}

/** Khung chung của các thao tác trên một lệnh: kiểm tra quyền, đổi lỗi nghiệp vụ thành phản hồi HTTP. */
function handleOrderAction(
  request: Request,
  parentOrderId: string,
  action: (username: string) => ParentOrder | OrderPriceField[] | Notification[] | OrderDetailData,
) {
  const user = getUser(request)
  if (!user) return errorResponse('Chưa đăng nhập', 401)
  try {
    if (!canSeeOrder(user, orderEngine.getOrder(parentOrderId))) {
      return errorResponse('Không tìm thấy lệnh', 404)
    }
    return HttpResponse.json(action(user.username))
  } catch (error) {
    if (error instanceof EngineError) return errorResponse(error.message, error.status)
    throw error
  }
}

/** Khung chung của API vận hành: chỉ role OPS được gọi. */
function handleOps(request: Request, action: (username: string) => unknown) {
  const user = getUser(request)
  if (!user) return errorResponse('Chưa đăng nhập', 401)
  if (user.role !== 'OPS') return errorResponse('Không có quyền vận hành', 403)
  try {
    return HttpResponse.json(action(user.username) as JsonBodyType)
  } catch (error) {
    if (error instanceof EngineError) return errorResponse(error.message, error.status)
    throw error
  }
}

export const handlers = [
  http.get('*/api/ops/overview', ({ request }) =>
    handleOps(request, () => ({
      ...orderEngine.getOpsOverview(),
      feed_fault_active: marketSimulator.isFeedStale(),
    })),
  ),

  http.post('*/api/ops/faults/reject', async ({ request }) => {
    const { parent_order_id } = (await request.json()) as FaultTargetRequest
    return handleOps(request, () => orderEngine.injectRejectNext(parent_order_id))
  }),

  http.post('*/api/ops/faults/lost-ack', async ({ request }) => {
    const { parent_order_id } = (await request.json()) as FaultTargetRequest
    return handleOps(request, () => orderEngine.injectLostAck(parent_order_id))
  }),

  http.post('*/api/ops/faults/duplicate-fill', async ({ request }) => {
    const { parent_order_id } = (await request.json()) as FaultTargetRequest
    return handleOps(request, () => orderEngine.injectDuplicateFill(parent_order_id))
  }),

  http.post('*/api/ops/faults/market-data', async ({ request }) => {
    const { stale } = (await request.json()) as { stale: boolean }
    return handleOps(request, () => {
      marketSimulator.setFeedStale(stale)
      return { stale }
    })
  }),

  http.post('*/api/ops/kill-switch', async ({ request }) => {
    const body = (await request.json()) as KillSwitchRequest
    return handleOps(request, (username) => orderEngine.activateKillSwitch(body, username))
  }),

  http.post('*/api/ops/kill-switch/release', async ({ request }) => {
    const body = (await request.json()) as KillSwitchRequest
    return handleOps(request, () => orderEngine.releaseKillSwitch(body))
  }),

  http.get('*/api/auth/demo-users', () => HttpResponse.json(DEMO_USERS)),

  http.post('*/api/auth/login', async ({ request }) => {
    const { username } = (await request.json()) as { username: string }
    const user = DEMO_USERS.find((item) => item.username === username)
    if (!user) return errorResponse('Tài khoản không tồn tại', 401)
    return HttpResponse.json(user)
  }),

  http.get('*/api/orders', ({ request }) => {
    const user = getUser(request)
    if (!user) return errorResponse('Chưa đăng nhập', 401)
    const orders = orderEngine
      .listOrders()
      .filter((order) => canSeeOrder(user, order))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
    return HttpResponse.json(orders)
  }),

  http.post('*/api/orders', async ({ request }) => {
    const user = getUser(request)
    if (!user) return errorResponse('Chưa đăng nhập', 401)
    const body = (await request.json()) as CreateOrderRequest
    const market = marketSimulator.getState()

    // Kiểm tra lại bằng đúng luật của form: giá có thể đã đổi từ lúc người dùng nhập.
    const errors = validateOrderValues(fromCreateOrderRequest(body), {
      getQuote: (symbol) => market.quotes.find((quote) => quote.symbol === symbol),
      today: market.trading_date,
    })
    if (errors.length > 0) {
      return HttpResponse.json({ message: errors[0].message, errors }, { status: 422 })
    }
    try {
      return HttpResponse.json({ parent_order: orderEngine.createOrder(body, user.username) }, { status: 201 })
    } catch (error) {
      if (error instanceof EngineError) return errorResponse(error.message, error.status)
      throw error
    }
  }),

  http.patch('*/api/orders/:id', async ({ request, params }) => {
    const body = (await request.json()) as UpdateOrderRequest
    return handleOrderAction(request, String(params.id), (username) =>
      orderEngine.updateOrder(String(params.id), body, username),
    )
  }),

  http.get('*/api/orders/:id', ({ request, params }) =>
    handleOrderAction(request, String(params.id), () => orderEngine.getOrder(String(params.id))),
  ),

  http.get('*/api/orders/:id/detail', ({ request, params }) =>
    handleOrderAction(request, String(params.id), () => {
      const id = String(params.id)
      return {
        parameters: orderEngine.getParameters(id),
        children: orderEngine.getChildren(id),
        executions: orderEngine.getExecutions(id),
        snapshot: orderEngine.getSnapshot(id) ?? null,
        events: orderEngine.getEvents(id),
      }
    }),
  ),

  http.get('*/api/orders/:id/notifications', ({ request, params }) =>
    handleOrderAction(request, String(params.id), () => orderEngine.getNotifications(String(params.id))),
  ),

  http.get('*/api/orders/:id/price-fields', ({ request, params }) =>
    handleOrderAction(request, String(params.id), () => orderEngine.getRepriceFields(String(params.id))),
  ),

  http.post('*/api/orders/:id/reprice', async ({ request, params }) => {
    const body = (await request.json()) as RepriceOrderRequest
    return handleOrderAction(request, String(params.id), (username) =>
      orderEngine.repriceOrder(String(params.id), body, username),
    )
  }),

  http.post('*/api/orders/:id/pause', ({ request, params }) =>
    handleOrderAction(request, String(params.id), (username) =>
      orderEngine.pauseOrder(String(params.id), username),
    ),
  ),

  http.post('*/api/orders/:id/resume', ({ request, params }) =>
    handleOrderAction(request, String(params.id), (username) =>
      orderEngine.resumeOrder(String(params.id), username),
    ),
  ),

  http.post('*/api/orders/:id/cancel', ({ request, params }) =>
    handleOrderAction(request, String(params.id), (username) =>
      orderEngine.cancelOrder(String(params.id), username),
    ),
  ),
]
