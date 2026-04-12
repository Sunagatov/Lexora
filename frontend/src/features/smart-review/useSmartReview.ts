import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {fetchSmartReview, completeSmartReviewItem} from './api'

export const SMART_REVIEW_KEY = ['smart-review'] as const

export function useSmartReview(enabled = true) {
  const queryClient = useQueryClient()

  const query = useQuery({queryKey: SMART_REVIEW_KEY, queryFn: fetchSmartReview, enabled})

  const mutation = useMutation({
    mutationFn: completeSmartReviewItem,
    onMutate: async () => {
      // cancel any in-flight smart-review refetch so it doesn't overwrite
      // the optimistic knowledge_level patch made by useWordUpdate
      await queryClient.cancelQueries({queryKey: SMART_REVIEW_KEY})
    },
    onSuccess: (updatedQueue) => queryClient.setQueryData(SMART_REVIEW_KEY, updatedQueue),
  })

  return {
    queue: query.data ?? null,
    isLoading: query.isLoading,
    completeItem: mutation.mutate,
  }
}
