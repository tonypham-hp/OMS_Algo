import { useMutation } from '@tanstack/react-query'
import { ordersService } from '@/services/orders.service'

export function useCreateOrder() {
  return useMutation({ mutationFn: ordersService.createOrder })
}
