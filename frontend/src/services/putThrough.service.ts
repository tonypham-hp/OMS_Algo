import type { CreatePutThroughRequest, PutThroughData, PutThroughDeal } from '@/types'
import { http } from './http'

export const putThroughService = {
  list: () => http.get<PutThroughData>('/api/put-through'),
  create: (request: CreatePutThroughRequest) => http.post<PutThroughDeal>('/api/put-through', request),
  /** Bên đối ứng xác nhận / từ chối (mô phỏng), hoặc hủy lệnh chưa khớp. */
  act: (dealId: string, action: 'confirm' | 'reject' | 'cancel') => http.post<PutThroughDeal>(`/api/put-through/${dealId}/${action}`),
}
