import type {
  ChangeRequestFilter,
  CreateChangeRequest,
  OrderRules,
  ParameterChangeRequest,
  SystemParameter,
} from '@/types'
import { http } from './http'

function toQuery(filter: ChangeRequestFilter) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filter)) if (value) params.set(key, value)
  const query = params.toString()
  return query ? `?${query}` : ''
}

export const configService = {
  listParameters: () => http.get<SystemParameter[]>('/api/config/parameters'),
  listRequests: (filter: ChangeRequestFilter) =>
    http.get<ParameterChangeRequest[]>(`/api/config/requests${toQuery(filter)}`),
  createRequest: (request: CreateChangeRequest) => http.post<ParameterChangeRequest>('/api/config/requests', request),
  approveRequest: (requestId: string, note: string) =>
    http.post<ParameterChangeRequest>(`/api/config/requests/${requestId}/approve`, { note }),
  rejectRequest: (requestId: string, note: string) =>
    http.post<ParameterChangeRequest>(`/api/config/requests/${requestId}/reject`, { note }),
  getOrderRules: () => http.get<OrderRules>('/api/config/order-rules'),
}
