import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {fetchSmartReview, completeSmartReviewItem, refreshSmartReview} from '@/features/smart-review/api/smartReviewApi'
import {queryKeys} from '@/app/queryKeys'

export function useSmartReview(enabled = true) {
  const queryClient = useQueryClient()

  const query = useQuery({queryKey: queryKeys.smartReview, queryFn: fetchSmartReview, enabled})

  const completeMutation = useMutation({
    mutationFn: completeSmartReviewItem,
    onMutate: async () => {
      await queryClient.cancelQueries({queryKey: queryKeys.smartReview})
    },
    onSuccess: (updatedQueue) => queryClient.setQueryData(queryKeys.smartReview, updatedQueue),
    onError: () => {
      void queryClient.invalidateQueries({queryKey: queryKeys.smartReview})
    },
  })

  const refreshMutation = useMutation({
    mutationFn: refreshSmartReview,
    onSuccess: (newQueue) => queryClient.setQueryData(queryKeys.smartReview, newQueue),
    onError: () => {
      void queryClient.invalidateQueries({queryKey: queryKeys.smartReview})
    },
  })

  return {
    queue: query.data ?? null,
    isLoading: query.isLoading,
    completeItem: completeMutation.mutate,
    refresh: refreshMutation.mutate,
    isRefreshing: refreshMutation.isPending,
  }
}
