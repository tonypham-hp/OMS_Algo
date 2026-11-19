import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { rulesService } from '@/services/rules.service'

const RULES_KEY = ['rule-packs']

export function useRulePacks() {
  return useQuery({ queryKey: RULES_KEY, queryFn: rulesService.getPacks, refetchInterval: 5000 })
}

export function useSetExperimentalPack() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: rulesService.setExperimental,
    onSuccess: (data) => queryClient.setQueryData(RULES_KEY, data),
  })
}
