import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {fetchSmartReview, completeSmartReviewItem, refreshSmartReview} from './api'
import {queryKeys} from '../../shared/queryKeys'

export function useSmartReview(enabled = true) {
  const queryClient = useQueryClient()

  const query = useQuery({queryKey: queryKeys.smartReview, queryFn: fetchSmartReview, enabled})

  const completeMutation = useMutation({
    mutationFn: completeSmartReviewItem,
    onMutate: async () => {
      await queryClient.cancelQueries({queryKey: queryKeys.smartReview})
    },
    onSuccess: (updatedQueue) => queryClient.setQueryData(queryKeys.smartReview, updatedQueue),
  })

  const refreshMutation = useMutation({
    mutationFn: refreshSmartReview,
    onSuccess: (newQueue) => queryClient.setQueryData(queryKeys.smartReview, newQueue),
  })

  return {
    queue: query.data ?? null,
    isLoading: query.isLoading,
    completeItem: completeMutation.mutate,
    refresh: refreshMutation.mutate,
    isRefreshing: refreshMutation.isPending,
  }
}
