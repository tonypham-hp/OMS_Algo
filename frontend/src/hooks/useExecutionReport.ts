import { useQuery } from '@tanstack/react-query'
import { reportService } from '@/services/report.service'
import { useAuthStore } from '@/store/auth.store'

/** Báo cáo không cần nhịp từng giây như sổ lệnh: 2 giây đủ thấy lệnh vừa hoàn tất. */
const REPORT_REFETCH_MS = 2000

export function useExecutionReport() {
  const username = useAuthStore((state) => state.user?.username)
  return useQuery({
    queryKey: ['execution-report', username],
    queryFn: reportService.getExecutionReport,
    refetchInterval: REPORT_REFETCH_MS,
    enabled: Boolean(username),
  })
}
