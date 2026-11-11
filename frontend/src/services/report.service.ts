import type { ExecutionReportData } from '@/types'
import { http } from './http'

export const reportService = {
  getExecutionReport: () => http.get<ExecutionReportData>('/api/reports/execution-quality'),
}
