import type {
  CreateOrderRequest,
  CreateOrderResponse,
  Notification,
  OrderDetailData,
  OrderPriceField,
  ParentOrder,
  RepriceOrderRequest,
  UpdateOrderRequest,
} from '@/types'
import { http } from './http'

export const ordersService = {
  listOrders: () => http.get<ParentOrder[]>('/api/orders'),
  getOrder: (parentOrderId: string) => http.get<ParentOrder>(`/api/orders/${parentOrderId}`),
  getOrderDetail: (parentOrderId: string) => http.get<OrderDetailData>(`/api/orders/${parentOrderId}/detail`),
  getNotifications: (parentOrderId: string) =>
    http.get<Notification[]>(`/api/orders/${parentOrderId}/notifications`),
  createOrder: (request: CreateOrderRequest) =>
    http.post<CreateOrderResponse>('/api/orders', request),
  updateOrder: (parentOrderId: string, request: UpdateOrderRequest) =>
    http.patch<ParentOrder>(`/api/orders/${parentOrderId}`, request),
  getPriceFields: (parentOrderId: string) =>
    http.get<OrderPriceField[]>(`/api/orders/${parentOrderId}/price-fields`),
  repriceOrder: (parentOrderId: string, request: RepriceOrderRequest) =>
    http.post<ParentOrder>(`/api/orders/${parentOrderId}/reprice`, request),
  pauseOrder: (parentOrderId: string) => http.post<ParentOrder>(`/api/orders/${parentOrderId}/pause`),
  resumeOrder: (parentOrderId: string) => http.post<ParentOrder>(`/api/orders/${parentOrderId}/resume`),
  cancelOrder: (parentOrderId: string) => http.post<ParentOrder>(`/api/orders/${parentOrderId}/cancel`),
}
