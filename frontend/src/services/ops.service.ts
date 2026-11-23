import type {
  ChildOrder,
  CoreRejectCode,
  KillSwitchRequest,
  KillSwitchState,
  OpsOverview,
  ParentOrder,
  ReopenOrderRequest,
  SymbolQuote,
} from '@/types'
import { http } from './http'

const injectInto = (path: string) => (parentOrderId: string) =>
  http.post<ParentOrder>(`/api/ops/faults/${path}`, { parent_order_id: parentOrderId })

export const opsService = {
  getOverview: () => http.get<OpsOverview>('/api/ops/overview'),
  injectReject: (parentOrderId: string, rejectCode?: CoreRejectCode) =>
    http.post<ParentOrder>('/api/ops/faults/reject', { parent_order_id: parentOrderId, reject_code: rejectCode }),
  injectTimeoutBeforeCore: injectInto('timeout-before-core'),
  injectTimeoutAfterCore: injectInto('timeout-after-core'),
  injectDuplicateFill: injectInto('duplicate-fill'),
  setMarketDataStale: (stale: boolean) => http.post<{ stale: boolean }>('/api/ops/faults/market-data', { stale }),
  activateKillSwitch: (request: KillSwitchRequest) => http.post<KillSwitchState>('/api/ops/kill-switch', request),
  releaseKillSwitch: (request: KillSwitchRequest) =>
    http.post<KillSwitchState>('/api/ops/kill-switch/release', request),
  reopenOrder: (parentOrderId: string, request: ReopenOrderRequest) =>
    http.post<ParentOrder>(`/api/ops/orders/${parentOrderId}/reopen`, request),
  reconcileChild: (childOrderId: string) => http.post<ChildOrder>(`/api/ops/children/${childOrderId}/reconcile`),
  /** Tạm ngừng (halt) hoặc cho giao dịch lại (resume) một mã – mô phỏng. */
  setSymbolHalt: (symbol: string, action: 'halt' | 'resume') => http.post<SymbolQuote>(`/api/ops/symbols/${symbol}/${action}`),
}
