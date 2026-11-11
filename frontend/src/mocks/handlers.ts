import type { JsonBodyType } from 'msw'
import { http, HttpResponse } from 'msw/http'
import { formatClock } from '@/lib/format'
import { getPauseReason } from '@/pages/OrderDetail/pauseReason'
import { fromCreateOrderRequest, validateOrderValues } from '@/pages/PlaceOrder/orderSchema'
import type {
  ChangeRequestFilter,
  ChangeRequestStatus,
  CreateChangeRequest,
  CreateOrderRequest,
  DashboardData,
  DecideChangeRequest,
  DemoUser,
  FaultTargetRequest,
  KillSwitchRequest,
  Notification,
  OrderDetailData,
  OrderPriceField,
  ParentOrder,
  ReopenOrderRequest,
  RepriceOrderRequest,
  SystemParameterCode,
  UpdateOrderRequest,
} from '@/types'
import { canSeeOrder } from './access'
import { DEMO_USERS } from './data'
import { EngineError } from './engine'
import { buildExecutionReport, getOrderMarketStats, type ReportSource } from './report'
import { configStore, marketTape, orderEngine, persistConfig } from './runtime'
import { marketSimulator } from './simulator'

function getUser(request: Request): DemoUser | undefined {
  const username = request.headers.get('X-User-Id')
  return DEMO_USERS.find((user) => user.username === username)
}


/** Số event gần nhất trả về cho Trung tâm lệnh và chuông thông báo. */
const DASHBOARD_EVENT_LIMIT = 200

function buildDashboard(user: DemoUser): DashboardData {
  const orders = orderEngine.listOrders().filter((order) => canSeeOrder(user, order))
  const visible = new Set(orders.map((order) => order.parent_order_id))
  const snapshots: DashboardData['snapshots'] = {}
  const pauseReasons: DashboardData['pause_reasons'] = {}
  for (const order of orders) {
    const id = order.parent_order_id
    const snapshot = orderEngine.getSnapshot(id)
    if (snapshot) snapshots[id] = snapshot
    const reason = order.status === 'PAUSED_SYSTEM' ? getPauseReason(orderEngine.getNotifications(id)) : null
    if (reason) pauseReasons[id] = reason
  }
  return {
    trading_date: marketSimulator.getState().trading_date,
    orders,
    children: orderEngine.listChildren().filter((child) => visible.has(child.parent_order_id)),
    executions: orderEngine.listExecutions().filter((item) => visible.has(item.parent_order_id)),
    snapshots,
    pause_reasons: pauseReasons,
    events: orderEngine
      .listEvents()
      .filter((event) => visible.has(event.parent_order_id))
      .slice(-DASHBOARD_EVENT_LIMIT),
  }
}

/** Thời điểm hiện tại theo đồng hồ giả lập, cùng dạng với OrderEvent.event_time. */
function simNow() {
  const state = marketSimulator.getState()
  return `${state.trading_date}T${formatClock(state.sim_seconds)}`
}

function reportSource(): ReportSource {
  return {
    tradingDate: marketSimulator.getState().trading_date,
    now: simNow(),
    orders: orderEngine.listOrders(),
    children: orderEngine.listChildren(),
    executions: orderEngine.listExecutions(),
    getSnapshot: orderEngine.getSnapshot,
    listTicks: marketTape.list,
  }
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

/** Thao tác đổi cấu hình: lưu ngay sau khi thành công. */
function handleConfigChange(request: Request, action: (username: string) => unknown) {
  const response = handleOps(request, action)
  if (response.ok) persistConfig()
  return response
}

export const handlers = [
  http.get('*/api/config/parameters', ({ request }) => handleOps(request, () => configStore.listParameters())),

  http.get('*/api/config/requests', ({ request }) => {
    const params = new URL(request.url).searchParams
    const filter: ChangeRequestFilter = {
      parameter_code: (params.get('parameter_code') as SystemParameterCode | null) ?? undefined,
      user: params.get('user') ?? undefined,
      status: (params.get('status') as ChangeRequestStatus | null) ?? undefined,
    }
    return handleOps(request, () => configStore.listRequests(filter))
  }),

  http.post('*/api/config/requests', async ({ request }) => {
    const body = (await request.json()) as CreateChangeRequest
    return handleConfigChange(request, (username) => configStore.createRequest(body, username))
  }),

  http.post('*/api/config/requests/:id/approve', async ({ request, params }) => {
    const { note } = (await request.json()) as DecideChangeRequest
    return handleConfigChange(request, (username) => configStore.approveRequest(String(params.id), note ?? '', username))
  }),

  http.post('*/api/config/requests/:id/reject', async ({ request, params }) => {
    const { note } = (await request.json()) as DecideChangeRequest
    return handleConfigChange(request, (username) => configStore.rejectRequest(String(params.id), note ?? '', username))
  }),

  /** Form đặt lệnh cần luật đặt lệnh, nên mọi người dùng đã đăng nhập đều đọc được. */
  http.get('*/api/config/order-rules', ({ request }) => {
    if (!getUser(request)) return errorResponse('Chưa đăng nhập', 401)
    return HttpResponse.json(configStore.getOrderRules())
  }),

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

  http.post('*/api/ops/faults/timeout-before-core', async ({ request }) => {
    const { parent_order_id } = (await request.json()) as FaultTargetRequest
    return handleOps(request, () => orderEngine.injectTimeout(parent_order_id, 'TIMEOUT_BEFORE_CORE'))
  }),

  http.post('*/api/ops/faults/timeout-after-core', async ({ request }) => {
    const { parent_order_id } = (await request.json()) as FaultTargetRequest
    return handleOps(request, () => orderEngine.injectTimeout(parent_order_id, 'TIMEOUT_AFTER_CORE'))
  }),

  http.post('*/api/ops/orders/:id/reopen', async ({ request, params }) => {
    const { reason } = (await request.json()) as ReopenOrderRequest
    return handleOps(request, (username) => orderEngine.reopenOrder(String(params.id), reason, username))
  }),

  http.post('*/api/ops/children/:id/reconcile', ({ request, params }) =>
    handleOps(request, (username) => orderEngine.reconcileChildNow(String(params.id), username)),
  ),

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

  http.get('*/api/dashboard', ({ request }) => {
    const user = getUser(request)
    if (!user) return errorResponse('Chưa đăng nhập', 401)
    return HttpResponse.json(buildDashboard(user))
  }),

  http.get('*/api/reports/execution-quality', ({ request }) => {
    const user = getUser(request)
    if (!user) return errorResponse('Chưa đăng nhập', 401)
    return HttpResponse.json(buildExecutionReport(user, reportSource()))
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
      orderRules: configStore.getOrderRules(),
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
      const snapshot = orderEngine.getSnapshot(id) ?? null
      return {
        parameters: orderEngine.getParameters(id),
        children: orderEngine.getChildren(id),
        executions: orderEngine.getExecutions(id),
        snapshot,
        events: orderEngine.getEvents(id),
        market: getOrderMarketStats(orderEngine.getOrder(id), snapshot, simNow(), marketTape.list),
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
