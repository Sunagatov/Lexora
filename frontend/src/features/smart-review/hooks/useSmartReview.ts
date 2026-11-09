import {useState} from 'react'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {fetchSmartReview, completeSmartReviewItem, refreshSmartReview} from '@/features/smart-review/api/smartReviewApi'
import {queryKeys} from '@/app/queryKeys'
import type {StudyQueue} from '@/features/smart-review/types/studyQueueTypes'

export function useSmartReview(enabled = true) {
  const queryClient = useQueryClient()
  const [failedItems, setFailedItems] = useState<number[]>([])
  const [refreshFailed, setRefreshFailed] = useState(false)

  const query = useQuery({queryKey: queryKeys.smartReview, queryFn: fetchSmartReview, enabled, staleTime: 60_000,
    refetchOnWindowFocus: false})

  const completeMutation = useMutation({
    mutationFn: completeSmartReviewItem,
    onMutate: async () => {
      await queryClient.cancelQueries({queryKey: queryKeys.smartReview})
    },
    onSuccess: (updatedQueue, itemId) => {
      const completedIds = new Set(updatedQueue.items.filter(item => item.is_completed).map(item => item.id))
      setFailedItems(current => current.filter(id => id !== itemId && !completedIds.has(id)))
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
    onError: (_error, itemId) => {
      setFailedItems(current => current.includes(itemId) ? current : [...current, itemId])
      void queryClient.invalidateQueries({queryKey: queryKeys.smartReview})
    },
  })

  const refreshMutation = useMutation({
    mutationFn: refreshSmartReview,
    onMutate: async () => {
      setRefreshFailed(false)
      await queryClient.cancelQueries({queryKey: queryKeys.smartReview})
    },
    onSuccess: (newQueue) => {setFailedItems([]); queryClient.setQueryData(queryKeys.smartReview, newQueue)},
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
