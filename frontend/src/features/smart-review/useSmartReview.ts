import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {fetchSmartReview, completeSmartReviewItem} from './api'

export const SMART_REVIEW_KEY = ['smart-review'] as const

export function useSmartReview() {
  const queryClient = useQueryClient()

  const query = useQuery({queryKey: SMART_REVIEW_KEY, queryFn: fetchSmartReview})

  const mutation = useMutation({
    mutationFn: completeSmartReviewItem,
    onSuccess: (updatedQueue) => queryClient.setQueryData(SMART_REVIEW_KEY, updatedQueue),
  })

  return {
    queue: query.data ?? null,
    isLoading: query.isLoading,
    completeItem: mutation.mutate,
  }
}
