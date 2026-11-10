import type { DashboardData } from '@/types'
import { http } from './http'

export const dashboardService = {
  getDashboard: () => http.get<DashboardData>('/api/dashboard'),
}
