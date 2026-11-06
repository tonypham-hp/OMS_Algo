import type {
  CreateOrderRequest,
  CreateOrderResponse,
  ParentOrder,
  UpdateOrderRequest,
} from '@/types'
import { http } from './http'

export const ordersService = {
  listOrders: () => http.get<ParentOrder[]>('/api/orders'),
  createOrder: (request: CreateOrderRequest) =>
    http.post<CreateOrderResponse>('/api/orders', request),
  updateOrder: (parentOrderId: string, request: UpdateOrderRequest) =>
    http.patch<ParentOrder>(`/api/orders/${parentOrderId}`, request),
  pauseOrder: (parentOrderId: string) => http.post<ParentOrder>(`/api/orders/${parentOrderId}/pause`),
  resumeOrder: (parentOrderId: string) => http.post<ParentOrder>(`/api/orders/${parentOrderId}/resume`),
  cancelOrder: (parentOrderId: string) => http.post<ParentOrder>(`/api/orders/${parentOrderId}/cancel`),
}
