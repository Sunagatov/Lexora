import {useState} from 'react'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {fetchSmartReview, completeSmartReviewItem, refreshSmartReview} from '@/features/smart-review/api/smartReviewApi'
import {queryKeys} from '@/app/queryKeys'
import type {StudyQueue} from '@/features/smart-review/types/studyQueueTypes'

type FailedAction = {kind: 'complete'; itemId: number} | {kind: 'refresh'}

export function useSmartReview(enabled = true) {
  const queryClient = useQueryClient()
  const [failedAction, setFailedAction] = useState<FailedAction | null>(null)

  const query = useQuery({queryKey: queryKeys.smartReview, queryFn: fetchSmartReview, enabled, staleTime: 60_000})

  const completeMutation = useMutation({
    mutationFn: completeSmartReviewItem,
    onMutate: async () => {
      setFailedAction(null)
      await queryClient.cancelQueries({queryKey: queryKeys.smartReview})
    },
    onSuccess: (updatedQueue) => queryClient.setQueryData<StudyQueue>(queryKeys.smartReview, current => {
      // An older completion response must not replace a new set or reduce progress.
      if (current && (current.id !== updatedQueue.id || current.completed_count > updatedQueue.completed_count)) return current
      return updatedQueue
    }),
    onError: (_error, itemId) => {
      setFailedAction({kind: 'complete', itemId})
      void queryClient.invalidateQueries({queryKey: queryKeys.smartReview})
    },
  })

  const refreshMutation = useMutation({
    mutationFn: refreshSmartReview,
    onMutate: async () => {
      setFailedAction(null)
      await queryClient.cancelQueries({queryKey: queryKeys.smartReview})
    },
    onSuccess: (newQueue) => queryClient.setQueryData(queryKeys.smartReview, newQueue),
    onError: () => {
      setFailedAction({kind: 'refresh'})
      void queryClient.invalidateQueries({queryKey: queryKeys.smartReview})
    },
  })

  return {
    queue: query.data ?? null,
    isLoading: query.isLoading,
    loadError: query.isError,
    retry: () => { void query.refetch() },
    actionError: failedAction?.kind === 'complete'
      ? 'Your word level was saved, but review progress could not be saved.'
      : failedAction?.kind === 'refresh' ? 'Could not create a new word mix. Your current set is still available.' : null,
    retryAction: () => {
      if (failedAction?.kind === 'complete') completeMutation.mutate(failedAction.itemId)
      else if (failedAction?.kind === 'refresh') refreshMutation.mutate()
    },
    completeItem: completeMutation.mutate,
    refresh: refreshMutation.mutate,
    isRefreshing: refreshMutation.isPending,
  }
}
