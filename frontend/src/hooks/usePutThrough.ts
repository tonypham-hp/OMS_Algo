import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { putThroughService } from '@/services/putThrough.service'
import { useAuthStore } from '@/store/auth.store'

const PT_KEY = 'put-through'

export function usePutThroughs() {
  const username = useAuthStore((state) => state.user?.username)
  return useQuery({ queryKey: [PT_KEY, username], queryFn: putThroughService.list, refetchInterval: 1000 })
}

export function useCreatePutThrough() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: putThroughService.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PT_KEY] }),
  })
}

export function usePutThroughAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'confirm' | 'reject' | 'cancel' }) => putThroughService.act(id, action),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PT_KEY] }),
  })
}
