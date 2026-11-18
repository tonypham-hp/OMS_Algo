import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { historyService, type ReconDecision } from '@/services/history.service'
import { useAuthStore } from '@/store/auth.store'
import type { DateRange } from '@/utils/dateRange'

/** Lịch sử, nhật ký: 2 giây như báo cáo. Đối soát: 1 giây như màn Vận hành, để lỗi vừa bơm hiện ngay. */
const HISTORY_REFETCH_MS = 2000
const RECON_REFETCH_MS = 1000
const RECON_KEY = 'reconciliation'

export function useHistory() {
  const username = useAuthStore((state) => state.user?.username)
  return useQuery({
    queryKey: ['history', username],
    queryFn: historyService.getHistory,
    refetchInterval: HISTORY_REFETCH_MS,
    enabled: Boolean(username),
  })
}

export function useReconciliation(range: DateRange, enabled = true) {
  const username = useAuthStore((state) => state.user?.username)
  return useQuery({
    queryKey: [RECON_KEY, username, range.from, range.to],
    queryFn: () => historyService.getReconciliation(range),
    refetchInterval: RECON_REFETCH_MS,
    enabled: enabled && Boolean(username),
  })
}

/** Kết quả trả về là đối soát mới nhất: ghi thẳng vào cache để bảng đổi ngay, rồi làm mới các màn liên quan. */
function useReconMutation<T>(mutationFn: (input: T) => ReturnType<typeof historyService.runReconciliation>) {
  const queryClient = useQueryClient()
  const username = useAuthStore((state) => state.user?.username)
  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      queryClient.setQueryData([RECON_KEY, username, data.from, data.to], data)
      void queryClient.invalidateQueries({ queryKey: ['history'] })
      void queryClient.invalidateQueries({ queryKey: ['orders'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useRunReconciliation() {
  return useReconMutation((range: DateRange) => historyService.runReconciliation(range))
}

export function useReconDecision() {
  return useReconMutation((decision: ReconDecision) => historyService.decide(decision))
}
