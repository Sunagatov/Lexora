import {useMutation, useQueryClient} from '@tanstack/react-query'
import {type Word, type WordKnowledgeLevel, updateWordKnowledgeLevel} from '../lib/api'

export function useWordUpdate(onMutate: () => void) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: ({wordId, knowledgeLevel}: {wordId: number; knowledgeLevel: WordKnowledgeLevel}) =>
      updateWordKnowledgeLevel(wordId, knowledgeLevel),

    onMutate: async ({wordId, knowledgeLevel}) => {
      onMutate()

      await queryClient.cancelQueries({queryKey: ['words']})

      const prev = queryClient.getQueryData<Word[]>(['words'])

      queryClient.setQueryData<Word[]>(['words'], (cur = []) =>
        cur.map((w) => (w.id === wordId ? {...w, knowledge_level: knowledgeLevel} : w)),
      )

      return {prev}
    },

    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['words'], ctx.prev)
    },

    onSettled: () => queryClient.invalidateQueries({queryKey: ['words']}),
  })

  return {
    updateLevel: (wordId: number, knowledgeLevel: WordKnowledgeLevel) =>
      mutation.mutate({wordId, knowledgeLevel}),
    pendingWordId: mutation.isPending ? (mutation.variables?.wordId ?? null) : null,
  }
}
