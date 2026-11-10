import { useQuery } from '@tanstack/react-query'
import { dashboardService } from '@/services/dashboard.service'
import { useAuthStore } from '@/store/auth.store'

/** Cùng nhịp với sổ lệnh: engine chạy theo từng giây. */
const DASHBOARD_REFETCH_MS = 1000

/** Dữ liệu Trung tâm lệnh. Chuông thông báo dùng chung query này, không gọi API thêm. */
export function useDashboard() {
  const username = useAuthStore((state) => state.user?.username)
  return useQuery({
    queryKey: ['dashboard', username],
    queryFn: dashboardService.getDashboard,
    refetchInterval: DASHBOARD_REFETCH_MS,
    enabled: Boolean(username),
  })
}
