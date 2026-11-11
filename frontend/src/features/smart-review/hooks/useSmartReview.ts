import {useState} from 'react'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {fetchSmartReview, completeSmartReviewItem, refreshSmartReview} from '@/features/smart-review/api/smartReviewApi'
import {queryKeys} from '@/app/queryKeys'
import type {StudyQueue} from '@/features/smart-review/types/studyQueueTypes'
import {isUncertainWriteError} from '@/shared/api/apiError'

export function useSmartReview(enabled = true) {
  const queryClient = useQueryClient()
  const [failures, setFailures] = useState<{itemId: number; queueId: number | undefined}[]>([])
  const [refreshFailed, setRefreshFailed] = useState(false)

  const query = useQuery({queryKey: queryKeys.smartReview, queryFn: fetchSmartReview, enabled, staleTime: 60_000,
    refetchOnWindowFocus: false})
  // A lost response is not proof of a lost write: refetch can acknowledge it.
  const failedItems = failures.filter(failure => failure.queueId === query.data?.id
    && query.data?.items.some(item => item.id === failure.itemId && !item.is_completed))
    .map(failure => failure.itemId)

  const completeMutation = useMutation({
    mutationFn: completeSmartReviewItem,
    // Completion is idempotent; ratings are not blindly retried.
    retry: (count, error) => count < 2 && isUncertainWriteError(error),
    retryDelay: attempt => 500 * (attempt + 1),
    onMutate: async () => {
      await queryClient.cancelQueries({queryKey: queryKeys.smartReview})
      return {queueId: queryClient.getQueryData<StudyQueue>(queryKeys.smartReview)?.id}
    },
    onSuccess: (updatedQueue, itemId) => {
      if ('queue_id' in updatedQueue) {
        setFailures(current => current.filter(failure => failure.itemId !== itemId || failure.queueId !== updatedQueue.queue_id))
        queryClient.setQueryData<StudyQueue>(queryKeys.smartReview, current => {
          if (!current || current.id !== updatedQueue.queue_id) return current
          return {...current, completed_count: Math.max(current.completed_count, updatedQueue.completed_count),
            items: current.items.map(item => item.id === updatedQueue.item_id
              ? {...item, is_completed: true, completed_at: updatedQueue.completed_at} : item)}
        })
        return
      }
      const completedIds = new Set(updatedQueue.items.filter(item => item.is_completed).map(item => item.id))
      setFailures(current => current.filter(failure => failure.queueId !== updatedQueue.id || failure.itemId !== itemId && !completedIds.has(failure.itemId)))
      queryClient.setQueryData<StudyQueue>(queryKeys.smartReview, current => {
      // An older completion response must not replace a new set or reduce progress.
      if (current && (current.id !== updatedQueue.id || current.completed_count > updatedQueue.completed_count)) return current
      if (!current) return updatedQueue
      const completed = new Map(updatedQueue.items.map(item => [item.id, item]))
      return {...current, completed_count: updatedQueue.completed_count, items: current.items.map(item => {
        const incoming = completed.get(item.id)
        return incoming?.is_completed && !item.is_completed
          ? {...item, is_completed: true, completed_at: incoming.completed_at}
          : item
      })}
      })
    },
    onError: (_error, itemId, context) => {
      setFailures(current => current.some(failure => failure.itemId === itemId && failure.queueId === context?.queueId)
        ? current : [...current, {itemId, queueId: context?.queueId}])
      void queryClient.invalidateQueries({queryKey: queryKeys.smartReview})
    },
  })

  const refreshMutation = useMutation({
    mutationFn: refreshSmartReview,
    onMutate: async () => {
      setRefreshFailed(false)
      await queryClient.cancelQueries({queryKey: queryKeys.smartReview})
    },
    onSuccess: (newQueue) => {setFailures([]); queryClient.setQueryData(queryKeys.smartReview, newQueue)},
    onError: () => {
      setRefreshFailed(true)
      void queryClient.invalidateQueries({queryKey: queryKeys.smartReview})
    },
  })

  return {
    queue: query.data ?? null,
    isLoading: query.isLoading,
    loadError: query.isError,
    retry: () => { void query.refetch() },
    actionError: failedItems.length
      ? `Your word level was saved, but review progress could not be saved for ${failedItems.length} ${failedItems.length === 1 ? 'word' : 'words'}.`
      : refreshFailed ? 'Could not create a new word mix. Your current set is still available.' : null,
    retryAction: () => {
      for (const itemId of failedItems) completeMutation.mutate(itemId)
      if (refreshFailed) refreshMutation.mutate()
    },
    completeItem: completeMutation.mutate,
    completeItemAsync: completeMutation.mutateAsync,
    refresh: refreshMutation.mutate,
    isRefreshing: refreshMutation.isPending,
  }
}
