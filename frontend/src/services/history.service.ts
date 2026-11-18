import type { HistoryData, ReconciliationData } from '@/types'
import type { DateRange } from '@/utils/dateRange'
import type { ReconStep } from '@/utils/reconcile'
import { http } from './http'

export interface ReconDecision extends DateRange {
  row_id: string
  step: ReconStep
  note: string
}

export const historyService = {
  getHistory: () => http.get<HistoryData>('/api/history'),
  getReconciliation: (range: DateRange) =>
    http.get<ReconciliationData>(`/api/reconciliation?from=${range.from}&to=${range.to}`),
  runReconciliation: (range: DateRange) => http.post<ReconciliationData>('/api/reconciliation/run', range),
  decide: (decision: ReconDecision) => http.post<ReconciliationData>('/api/reconciliation/decisions', decision),
}
