import {useState} from 'react'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {queryKeys} from '@/app/queryKeys'
import {usePublicConfig} from '@/shared/config/usePublicConfig'
import type {Topic} from '@/features/topics/types/topicTypes'
import type {Word} from '@/features/words/types/wordTypes'
import {fetchTrashTopics, restoreTopic} from '@/features/topics/api/topicsApi'
import {purgeTrash} from '@/features/trash/api/trashApi'
import {fetchTrashWords, restoreWord} from '@/features/words/api/wordsApi'

const DEFAULT_RETENTION_DAYS = 30

export function useTrashPageState() {
  const queryClient = useQueryClient()
  const [confirmPurge, setConfirmPurge] = useState(false)
  const [restoreTopicId, setRestoreTopicId] = useState<number | null>(null)
  const [restoreTopicError, setRestoreTopicError] = useState<string | null>(null)
  const [restoreWordError, setRestoreWordError] = useState<{id: number; message: string} | null>(null)

  const configQuery = usePublicConfig()
  const wordsQuery = useQuery({queryKey: queryKeys.trashWords, queryFn: fetchTrashWords})
  const topicsQuery = useQuery({queryKey: queryKeys.trashTopics, queryFn: fetchTrashTopics})

  const retentionDays = configQuery.data?.trash_retention_days ?? DEFAULT_RETENTION_DAYS
  const words = wordsQuery.data ?? []
  const topics = topicsQuery.data ?? []
  const pendingRestoreTopic = topics.find((topic) => topic.id === restoreTopicId) ?? null

  async function invalidateTrashDependencies() {
    await Promise.all([
      queryClient.invalidateQueries({queryKey: queryKeys.topics}),
      queryClient.invalidateQueries({queryKey: queryKeys.words}),
      queryClient.invalidateQueries({queryKey: queryKeys.trashWords}),
      queryClient.invalidateQueries({queryKey: queryKeys.trashTopics}),
      queryClient.invalidateQueries({queryKey: queryKeys.topicSidebar}),
      queryClient.invalidateQueries({queryKey: queryKeys.stats}),
      queryClient.invalidateQueries({queryKey: queryKeys.smartReview}),
    ])
  }

  const restoreWordMutation = useMutation({
    mutationFn: restoreWord,
    onSuccess: async (restored) => {
      queryClient.setQueryData<Word[]>(queryKeys.trashWords, (current = []) =>
        current.filter((word) => word.id !== restored.id),
      )
      await invalidateTrashDependencies()
      setRestoreWordError((current) => (current?.id === restored.id ? null : current))
    },
    onError: (error: Error, wordId) => {
      setRestoreWordError({id: wordId, message: error.message})
    },
  })

  const restoreTopicMutation = useMutation({
    mutationFn: ({id, restoreWords}: {id: number; restoreWords: boolean}) => restoreTopic(id, restoreWords),
    onSuccess: async (restored) => {
      queryClient.setQueryData<Topic[]>(queryKeys.trashTopics, (current = []) =>
        current.filter((topic) => topic.id !== restored.id),
      )
      await invalidateTrashDependencies()
      setRestoreTopicId(null)
      setRestoreTopicError(null)
    },
    onError: (error: Error) => {
      setRestoreTopicError(error.message)
    },
  })

  const purgeMutation = useMutation({
    mutationFn: purgeTrash,
    onSuccess: async () => {
      await invalidateTrashDependencies()
      setConfirmPurge(false)
    },
  })

  function openRestoreTopic(topicId: number) {
    setRestoreTopicId(topicId)
    setRestoreTopicError(null)
  }

  function clearRestoreTopicDialog() {
    setRestoreTopicId(null)
    setRestoreTopicError(null)
  }

  function restoreSingleWord(wordId: number) {
    setRestoreWordError((current) => (current?.id === wordId ? null : current))
    restoreWordMutation.mutate(wordId)
  }

  function daysLeft(deletedAt: string) {
    return Math.max(0, retentionDays - Math.floor((Date.now() - new Date(deletedAt).getTime()) / 86400000))
  }

  return {
    retentionDays,
    words,
    topics,
    confirmPurge,
    setConfirmPurge,
    restoreTopicId,
    restoreTopicError,
    restoreWordError,
    pendingRestoreTopic,
    restoreWordMutation,
    restoreTopicMutation,
    purgeMutation,
    openRestoreTopic,
    clearRestoreTopicDialog,
    restoreSingleWord,
    daysLeft,
  }
}
