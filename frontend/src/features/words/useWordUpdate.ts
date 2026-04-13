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
      const prev = queryClient.getQueryData<Word[]>(queryKeys.words)
      patchWordLevel(queryClient, wordId, level)
      return {prev}
    },

    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKeys.words, ctx.prev)
      queryClient.invalidateQueries({queryKey: queryKeys.smartReview})
    },

    onSettled: () => {
      queryClient.invalidateQueries({queryKey: queryKeys.words})
      queryClient.invalidateQueries({queryKey: queryKeys.smartReview})
    },
  })

  return {
    updateLevel: (wordId: number, level: WordKnowledgeLevel) => mutation.mutate({wordId, level}),
    pendingWordId: mutation.isPending ? (mutation.variables?.wordId ?? null) : null,
  }
}
