import type { CreateOrderRequest, CreateOrderResponse } from '@/types'
import { http } from './http'

export const ordersService = {
  createOrder: (request: CreateOrderRequest) =>
    http.post<CreateOrderResponse>('/api/orders', request),
}
