import type { ChildOrder, KillSwitchRequest, KillSwitchState, OpsOverview, ParentOrder, ReopenOrderRequest } from '@/types'
import { http } from './http'

const injectInto = (path: string) => (parentOrderId: string) =>
  http.post<ParentOrder>(`/api/ops/faults/${path}`, { parent_order_id: parentOrderId })

export const opsService = {
  getOverview: () => http.get<OpsOverview>('/api/ops/overview'),
  injectReject: injectInto('reject'),
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
}
