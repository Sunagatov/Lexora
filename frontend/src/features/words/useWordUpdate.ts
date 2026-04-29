import {useMutation, useQueryClient} from '@tanstack/react-query'
import type {Word, WordKnowledgeLevel} from '../../shared/types'
import {updateWordKnowledgeLevel} from './api'
import {queryKeys} from '../../shared/queryKeys'
import {patchWordLevel} from './wordCache'

export function useWordUpdate(onMutate: () => void, source = 'study_list') {
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
      void queryClient.invalidateQueries({queryKey: queryKeys.topicSidebar})
      void queryClient.invalidateQueries({queryKey: queryKeys.smartReview})
    },

    onSettled: () => {
      void queryClient.invalidateQueries({queryKey: queryKeys.words})
      void queryClient.invalidateQueries({queryKey: queryKeys.topicSidebar})
      void queryClient.invalidateQueries({queryKey: queryKeys.smartReview})
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
