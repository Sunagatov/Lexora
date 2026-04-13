import {useMutation, useQueryClient} from '@tanstack/react-query'
import type {Word, WordKnowledgeLevel, StudyQueue} from '../../shared/http'
import {updateWordKnowledgeLevel} from './api'
import {queryKeys} from '../../shared/queryKeys'

export function useWordUpdate(onMutate: () => void, source = 'study_list') {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: ({wordId, level}: {wordId: number; level: WordKnowledgeLevel}) =>
      updateWordKnowledgeLevel(wordId, level, source),

    onMutate: async ({wordId, level}) => {
      onMutate()
      // Cancel any in-flight word queries (both flat and topic-scoped)
      await queryClient.cancelQueries({queryKey: queryKeys.words})
      const prev = queryClient.getQueryData<Word[]>(queryKeys.words)

      // Patch all cached word lists (flat all-words + any topic-scoped caches)
      queryClient.setQueriesData<Word[]>({queryKey: queryKeys.words}, (cur = []) =>
        cur.map((w) => w.id === wordId ? {...w, knowledge_level: level} : w),
      )

      // also patch the smart review queue cache so level badges update immediately
      queryClient.setQueryData<StudyQueue>(queryKeys.smartReview, (cur) => {
        if (!cur) return cur
        return {
          ...cur,
          items: cur.items.map((item) =>
            item.word.id === wordId
              ? {...item, word: {...item.word, knowledge_level: level}}
              : item,
          ),
        }
      })

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
