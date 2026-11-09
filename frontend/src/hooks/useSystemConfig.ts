import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { configService } from '@/services/config.service'
import { useAuthStore } from '@/store/auth.store'
import type { ChangeRequestFilter, CreateChangeRequest } from '@/types'

const CONFIG_KEY = 'config'
/** Hỏi lại định kỳ để thấy ngay yêu cầu do người vận hành khác vừa tạo hoặc duyệt. */
const CONFIG_REFETCH_MS = 3000

export function useSystemParameters() {
  const username = useAuthStore((state) => state.user?.username)
  return useQuery({
    queryKey: [CONFIG_KEY, username, 'parameters'],
    queryFn: configService.listParameters,
    refetchInterval: CONFIG_REFETCH_MS,
  })
}

export function useChangeRequests(filter: ChangeRequestFilter) {
  const username = useAuthStore((state) => state.user?.username)
  return useQuery({
    queryKey: [CONFIG_KEY, username, 'requests', filter],
    queryFn: () => configService.listRequests(filter),
    refetchInterval: CONFIG_REFETCH_MS,
  })
}

/** Luật đặt lệnh cho form đặt lệnh: loại lệnh đang bật, khoảng slice Iceberg, trần POV. */
export function useOrderRules() {
  const username = useAuthStore((state) => state.user?.username)
  return useQuery({
    queryKey: [CONFIG_KEY, username, 'order-rules'],
    queryFn: configService.getOrderRules,
    refetchInterval: CONFIG_REFETCH_MS,
  })
}

function useInvalidateConfig() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: [CONFIG_KEY] })
}

export function useCreateChangeRequest() {
  const invalidate = useInvalidateConfig()
  return useMutation({
    mutationFn: (request: CreateChangeRequest) => configService.createRequest(request),
    onSuccess: invalidate,
  })
}

export type ChangeDecision = { requestId: string; decision: 'APPROVE' | 'REJECT'; note: string }

export function useDecideChangeRequest() {
  const invalidate = useInvalidateConfig()
  return useMutation({
    mutationFn: ({ requestId, decision, note }: ChangeDecision) =>
      decision === 'APPROVE' ? configService.approveRequest(requestId, note) : configService.rejectRequest(requestId, note),
    onSuccess: invalidate,
  })
}
