import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ordersService } from '@/services/orders.service'
import { useAuthStore } from '@/store/auth.store'
import type { UpdateOrderRequest } from '@/types'

const ORDERS_KEY = 'orders'
/** Hỏi lại API mỗi giây để bảng tự cập nhật khi engine chạy. */
const ORDERS_REFETCH_MS = 1000

export function useOrders() {
  // Có username trong khóa để đổi tài khoản không thấy lại dữ liệu của người trước.
  const username = useAuthStore((state) => state.user?.username)
  return useQuery({
    queryKey: [ORDERS_KEY, username],
    queryFn: ordersService.listOrders,
    refetchInterval: ORDERS_REFETCH_MS,
  })
}

function useInvalidateOrders() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: [ORDERS_KEY] })
}

export function useCreateOrder() {
  const invalidate = useInvalidateOrders()
  return useMutation({ mutationFn: ordersService.createOrder, onSuccess: invalidate })
}

export function useUpdateOrder() {
  const invalidate = useInvalidateOrders()
  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: UpdateOrderRequest }) =>
      ordersService.updateOrder(id, request),
    onSuccess: invalidate,
  })
}

export function usePauseOrder() {
  const invalidate = useInvalidateOrders()
  return useMutation({ mutationFn: ordersService.pauseOrder, onSuccess: invalidate })
}

export function useResumeOrder() {
  const invalidate = useInvalidateOrders()
  return useMutation({ mutationFn: ordersService.resumeOrder, onSuccess: invalidate })
}

export function useCancelOrder() {
  const invalidate = useInvalidateOrders()
  return useMutation({ mutationFn: ordersService.cancelOrder, onSuccess: invalidate })
}
