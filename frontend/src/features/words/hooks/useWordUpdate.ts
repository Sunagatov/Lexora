import {useMutation, useMutationState, useQueryClient} from '@tanstack/react-query'
import type {Word, WordKnowledgeLevel} from '@/features/words/types/wordTypes'
import type {StudyQueue} from '@/features/smart-review/types/studyQueueTypes'
import {updateWordKnowledgeLevel} from '@/features/words/api/wordsApi'
import type {WordListResponse} from '@/features/words/api/wordsApi'
import {queryKeys} from '@/app/queryKeys'
import {invalidateWordDependencies, patchWordLevel} from '@/features/words/model/wordCache'
import {DEFAULT_WORD_PROGRESS_SOURCE} from '@/features/words/model/wordDomain'

const LEVEL_MUTATION_KEY = ['word-level-update']

export function useWordUpdate(onMutate: () => void, source = DEFAULT_WORD_PROGRESS_SOURCE) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationKey: LEVEL_MUTATION_KEY,
    mutationFn: ({wordId, level}: {wordId: number; level: WordKnowledgeLevel}) =>
      updateWordKnowledgeLevel(wordId, level, source),

    onMutate: async ({wordId, level}) => {
      onMutate()
      await Promise.all([
        queryClient.cancelQueries({queryKey: queryKeys.words}),
        queryClient.cancelQueries({queryKey: queryKeys.wordList}),
        queryClient.cancelQueries({queryKey: queryKeys.smartReview}),
      ])
      const prevWordQueries = queryClient.getQueriesData<Word[]>({queryKey: queryKeys.words})
      const prevWordPages = queryClient.getQueriesData<WordListResponse>({queryKey: queryKeys.wordList})
      const prevQueue = queryClient.getQueryData<StudyQueue>(queryKeys.smartReview)
      const prevReviewWord = prevQueue?.items.find((item) => item.word_id === wordId)?.word
      patchWordLevel(queryClient, wordId, level)
      return {prevWordQueries, prevWordPages, prevQueueId: prevQueue?.id, prevReviewWord}
    },

    onError: (_e, {wordId}, ctx) => {
      for (const [key, previous] of ctx?.prevWordQueries ?? []) {
        const before = previous?.find(word => word.id === wordId)
        if (before) queryClient.setQueryData<Word[]>(key, current =>
          current?.map(word => word.id === wordId ? {...word, knowledge_level: before.knowledge_level} : word),
        )
      }
      for (const [key, previous] of ctx?.prevWordPages ?? []) {
        const before = previous?.words.find(word => word.id === wordId)
        if (before) queryClient.setQueryData<WordListResponse>(key, current =>
          current ? {...current, words: current.words.map(word => word.id === wordId ? {...word, knowledge_level: before.knowledge_level} : word)} : current,
        )
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

    onSuccess: (updated, {level}) => {
      // A rating response can predate a concurrent heart or content edit.
      // Apply only the field this request changed.
      patchWordLevel(queryClient, updated.id, updated.knowledge_level ?? level)
      queryClient.setQueryData<Word>(queryKeys.word(updated.id), current =>
        current ? {...current, knowledge_level: updated.knowledge_level} : updated,
      )
    },

    onSettled: () => {
      invalidateWordDependencies(queryClient, [], {preserveWordPages: true})
    },
  })

  const pendingIds = useMutationState({
    filters: {mutationKey: LEVEL_MUTATION_KEY, status: 'pending'},
    select: item => (item.state.variables as {wordId: number}).wordId,
  })

  return {
    updateLevel: (wordId: number, level: WordKnowledgeLevel) =>
      mutation.mutate({wordId, level}),
    updateLevelAsync: (wordId: number, level: WordKnowledgeLevel) =>
      mutation.mutateAsync({wordId, level}),
    pendingWordId: mutation.isPending ? (mutation.variables?.wordId ?? null) : null,
    pendingWordIds: new Set(pendingIds),
  }
}
