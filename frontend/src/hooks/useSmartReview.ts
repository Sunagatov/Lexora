import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {completeSmartReviewItem, fetchSmartReview} from '../lib/api'

export const SMART_REVIEW_KEY = ['smart-review'] as const

export function useSmartReview() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: SMART_REVIEW_KEY,
    queryFn: fetchSmartReview,
  })

  const mutation = useMutation({
    mutationFn: completeSmartReviewItem,
    onSuccess: (updatedQueue) => {
      queryClient.setQueryData(SMART_REVIEW_KEY, updatedQueue)
    },
  })

  return {
    queue: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    completeItem: mutation.mutate,
    isCompleting: mutation.isPending,
  }
}
