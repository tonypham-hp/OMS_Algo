import type { KillSwitchRequest, KillSwitchState, OpsOverview, ParentOrder } from '@/types'
import { http } from './http'

const injectInto = (path: string) => (parentOrderId: string) =>
  http.post<ParentOrder>(`/api/ops/faults/${path}`, { parent_order_id: parentOrderId })

export const opsService = {
  getOverview: () => http.get<OpsOverview>('/api/ops/overview'),
  injectReject: injectInto('reject'),
  injectLostAck: injectInto('lost-ack'),
  injectDuplicateFill: injectInto('duplicate-fill'),
  setMarketDataStale: (stale: boolean) => http.post<{ stale: boolean }>('/api/ops/faults/market-data', { stale }),
  activateKillSwitch: (request: KillSwitchRequest) => http.post<KillSwitchState>('/api/ops/kill-switch', request),
  releaseKillSwitch: (request: KillSwitchRequest) =>
    http.post<KillSwitchState>('/api/ops/kill-switch/release', request),
}
