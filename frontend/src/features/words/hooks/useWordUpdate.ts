import {useMutation, useQueryClient} from '@tanstack/react-query'
import type {Word, WordKnowledgeLevel} from '@/features/words/types/wordTypes'
import type {StudyQueue} from '@/features/smart-review/types/studyQueueTypes'
import {updateWordKnowledgeLevel} from '@/features/words/api/wordsApi'
import {queryKeys} from '@/app/queryKeys'
import {invalidateWordDependencies, patchWordLevel, replaceWordInLists} from '@/features/words/model/wordCache'
import {DEFAULT_WORD_PROGRESS_SOURCE} from '@/features/words/model/wordDomain'

export function useWordUpdate(onMutate: () => void, source = DEFAULT_WORD_PROGRESS_SOURCE) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: ({wordId, level}: {wordId: number; level: WordKnowledgeLevel}) =>
      updateWordKnowledgeLevel(wordId, level, source),

    onMutate: async ({wordId, level}) => {
      onMutate()
      await Promise.all([
        queryClient.cancelQueries({queryKey: queryKeys.words}),
        queryClient.cancelQueries({queryKey: queryKeys.smartReview}),
      ])
      const prevWordQueries = queryClient.getQueriesData<Word[]>({queryKey: queryKeys.words})
      const prevQueue = queryClient.getQueryData<StudyQueue>(queryKeys.smartReview)
      const prevReviewWord = prevQueue?.items.find((item) => item.word_id === wordId)?.word
      patchWordLevel(queryClient, wordId, level)
      return {prevWordQueries, prevQueueId: prevQueue?.id, prevReviewWord}
    },

    onError: (_e, {wordId}, ctx) => {
      for (const [key, data] of ctx?.prevWordQueries ?? []) {
        queryClient.setQueryData(key, data)
      }
      const prevWord = ctx?.prevReviewWord
      if (prevWord) {
        queryClient.setQueryData<StudyQueue>(queryKeys.smartReview, (queue) => {
          if (!queue || queue.id !== ctx.prevQueueId) return queue
          return {
            ...queue,
            items: queue.items.map((item) => item.word_id === wordId
              ? {...item, word: {...item.word, knowledge_level: prevWord.knowledge_level}}
              : item),
          }
        })
      }
    },

    onSuccess: (updated) => replaceWordInLists(queryClient, updated),

    onSettled: () => {
      invalidateWordDependencies(queryClient)
    },
  })

  return {
    updateLevel: (wordId: number, level: WordKnowledgeLevel) =>
      mutation.mutate({wordId, level}),
    updateLevelAsync: (wordId: number, level: WordKnowledgeLevel) =>
      mutation.mutateAsync({wordId, level}),
    pendingWordId: mutation.isPending ? (mutation.variables?.wordId ?? null) : null,
  }
}
