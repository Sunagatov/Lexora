import {useMutation, useQueryClient} from '@tanstack/react-query'
import type {Word, WordKnowledgeLevel} from '@/features/words/types/wordTypes'
import {updateWordKnowledgeLevel} from '@/features/words/api/wordsApi'
import {queryKeys} from '@/app/queryKeys'
import {invalidateWordDependencies, patchWordLevel} from '@/features/words/model/wordCache'
import {DEFAULT_WORD_PROGRESS_SOURCE} from '@/features/words/model/wordDomain'

export function useWordUpdate(onMutate: () => void, source = DEFAULT_WORD_PROGRESS_SOURCE) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: ({wordId, level}: {wordId: number; level: WordKnowledgeLevel}) =>
      updateWordKnowledgeLevel(wordId, level, source),

    onMutate: async ({wordId, level}) => {
      onMutate()
      await queryClient.cancelQueries({queryKey: queryKeys.words})
      const prevWordQueries = queryClient.getQueriesData<Word[]>({queryKey: queryKeys.words})
      patchWordLevel(queryClient, wordId, level)
      return {prevWordQueries}
    },

    onError: (_e, _v, ctx) => {
      for (const [key, data] of ctx?.prevWordQueries ?? []) {
        queryClient.setQueryData(key, data)
      }
      invalidateWordDependencies(queryClient)
    },

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
