import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { opsService } from '@/services/ops.service'
import { useAuthStore } from '@/store/auth.store'

const OPS_KEY = 'ops'
const OPS_REFETCH_MS = 1000

export type FaultCommand =
  | { type: 'reject' | 'lost-ack' | 'duplicate-fill'; parentOrderId: string }
  | { type: 'market-data'; stale: boolean }

function runFault(command: FaultCommand): Promise<unknown> {
  switch (command.type) {
    case 'reject':
      return opsService.injectReject(command.parentOrderId)
    case 'lost-ack':
      return opsService.injectLostAck(command.parentOrderId)
    case 'duplicate-fill':
      return opsService.injectDuplicateFill(command.parentOrderId)
    case 'market-data':
      return opsService.setMarketDataStale(command.stale)
  }
}

export function useOpsOverview() {
  const username = useAuthStore((state) => state.user?.username)
  return useQuery({
    queryKey: [OPS_KEY, username],
    queryFn: opsService.getOverview,
    refetchInterval: OPS_REFETCH_MS,
  })
}

/** Các thao tác vận hành làm đổi cả sổ lệnh, nên cập nhật lại cả hai. */
function useInvalidateOps() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [OPS_KEY] }),
      queryClient.invalidateQueries({ queryKey: ['orders'] }),
    ])
}

export function useInjectFault() {
  const invalidate = useInvalidateOps()
  return useMutation({ mutationFn: runFault, onSuccess: invalidate })
}

export function useActivateKillSwitch() {
  const invalidate = useInvalidateOps()
  return useMutation({ mutationFn: opsService.activateKillSwitch, onSuccess: invalidate })
}

export function useReleaseKillSwitch() {
  const invalidate = useInvalidateOps()
  return useMutation({ mutationFn: opsService.releaseKillSwitch, onSuccess: invalidate })
}
