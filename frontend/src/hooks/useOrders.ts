import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ordersService } from '@/services/orders.service'
import { useAuthStore } from '@/store/auth.store'
import type { RepriceOrderRequest, UpdateOrderRequest } from '@/types'

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

export function useOrder(parentOrderId: string) {
  const username = useAuthStore((state) => state.user?.username)
  return useQuery({
    queryKey: [ORDERS_KEY, username, parentOrderId],
    queryFn: () => ordersService.getOrder(parentOrderId),
    refetchInterval: ORDERS_REFETCH_MS,
    retry: false,
  })
}

export function useOrderDetail(parentOrderId: string) {
  const username = useAuthStore((state) => state.user?.username)
  return useQuery({
    queryKey: [ORDERS_KEY, username, parentOrderId, 'detail'],
    queryFn: () => ordersService.getOrderDetail(parentOrderId),
    refetchInterval: ORDERS_REFETCH_MS,
    retry: false,
  })
}

export function useOrderNotifications(parentOrderId: string, enabled: boolean) {
  const username = useAuthStore((state) => state.user?.username)
  return useQuery({
    queryKey: [ORDERS_KEY, username, parentOrderId, 'notifications'],
    queryFn: () => ordersService.getNotifications(parentOrderId),
    enabled,
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

export function useOrderPriceFields(parentOrderId: string) {
  return useQuery({
    queryKey: ['order-price-fields', parentOrderId],
    queryFn: () => ordersService.getPriceFields(parentOrderId),
    // Luôn lấy mới mỗi lần mở form, vì giá đã có thể được sửa trước đó.
    gcTime: 0,
  })
}

export function useRepriceOrder() {
  const invalidate = useInvalidateOrders()
  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: RepriceOrderRequest }) =>
      ordersService.repriceOrder(id, request),
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
