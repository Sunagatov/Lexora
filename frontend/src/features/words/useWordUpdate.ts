import {useMutation, useQueryClient} from '@tanstack/react-query'
import type {Word, WordKnowledgeLevel} from '../../shared/http'
import {updateWordKnowledgeLevel} from './api'

export function useWordUpdate(onMutate: () => void) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: ({wordId, level}: {wordId: number; level: WordKnowledgeLevel}) =>
      updateWordKnowledgeLevel(wordId, level),

    onMutate: async ({wordId, level}) => {
      onMutate()
      await queryClient.cancelQueries({queryKey: ['words']})
      const prev = queryClient.getQueryData<Word[]>(['words'])
      queryClient.setQueryData<Word[]>(['words'], (cur = []) =>
        cur.map((w) => w.id === wordId ? {...w, knowledge_level: level} : w),
      )
      return {prev}
    },

    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['words'], ctx.prev)
    },

    onSettled: () => queryClient.invalidateQueries({queryKey: ['words']}),
  })

  return {
    updateLevel: (wordId: number, level: WordKnowledgeLevel) => mutation.mutate({wordId, level}),
    pendingWordId: mutation.isPending ? (mutation.variables?.wordId ?? null) : null,
  }
}
