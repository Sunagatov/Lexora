import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {fetchSmartReview, completeSmartReviewItem, refreshSmartReview} from './api'

export const SMART_REVIEW_KEY = ['smart-review'] as const

export function useSmartReview(enabled = true) {
  const queryClient = useQueryClient()

  const query = useQuery({queryKey: SMART_REVIEW_KEY, queryFn: fetchSmartReview, enabled})

  const completeMutation = useMutation({
    mutationFn: completeSmartReviewItem,
    onMutate: async () => {
      await queryClient.cancelQueries({queryKey: SMART_REVIEW_KEY})
    },
    onSuccess: (updatedQueue) => queryClient.setQueryData(SMART_REVIEW_KEY, updatedQueue),
  })

  const refreshMutation = useMutation({
    mutationFn: refreshSmartReview,
    onSuccess: (newQueue) => queryClient.setQueryData(SMART_REVIEW_KEY, newQueue),
  })

  return {
    queue: query.data ?? null,
    isLoading: query.isLoading,
    completeItem: completeMutation.mutate,
    refresh: refreshMutation.mutate,
    isRefreshing: refreshMutation.isPending,
  }
}
