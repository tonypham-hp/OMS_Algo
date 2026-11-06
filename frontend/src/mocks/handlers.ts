import { http, HttpResponse } from 'msw/http'
import { toDateString } from '@/lib/format'
import { fromCreateOrderRequest, validateOrderValues } from '@/pages/PlaceOrder/orderSchema'
import type { CreateOrderRequest, DemoUser, ParentOrder, UpdateOrderRequest } from '@/types'
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
  action: (username: string) => ParentOrder,
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

export const handlers = [
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
      today: toDateString(new Date()),
    })
    if (errors.length > 0) {
      return HttpResponse.json({ message: errors[0].message, errors }, { status: 422 })
    }
    return HttpResponse.json({ parent_order: orderEngine.createOrder(body, user.username) }, { status: 201 })
  }),

  http.patch('*/api/orders/:id', async ({ request, params }) => {
    const body = (await request.json()) as UpdateOrderRequest
    return handleOrderAction(request, String(params.id), (username) =>
      orderEngine.updateOrder(String(params.id), body, username),
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
