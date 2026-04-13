import {useMutation, useQueryClient} from '@tanstack/react-query'
import type {Word, WordKnowledgeLevel, StudyQueue} from '../../shared/http'
import {updateWordKnowledgeLevel} from './api'
import {SMART_REVIEW_KEY} from '../smart-review/useSmartReview'

export function useWordUpdate(onMutate: () => void, source = 'study_list') {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: ({wordId, level}: {wordId: number; level: WordKnowledgeLevel}) =>
      updateWordKnowledgeLevel(wordId, level, source),

    onMutate: async ({wordId, level}) => {
      onMutate()
      await queryClient.cancelQueries({queryKey: ['words']})
      const prev = queryClient.getQueryData<Word[]>(['words'])

      // patch the main words cache
      queryClient.setQueryData<Word[]>(['words'], (cur = []) =>
        cur.map((w) => w.id === wordId ? {...w, knowledge_level: level} : w),
      )

      // also patch the smart review queue cache so level badges update immediately
      queryClient.setQueryData<StudyQueue>(SMART_REVIEW_KEY, (cur) => {
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
      if (ctx?.prev) queryClient.setQueryData(['words'], ctx.prev)
      queryClient.invalidateQueries({queryKey: SMART_REVIEW_KEY})
    },

    onSettled: () => {
      queryClient.invalidateQueries({queryKey: ['words']})
      queryClient.invalidateQueries({queryKey: SMART_REVIEW_KEY})
    },
  })

  return {
    updateLevel: (wordId: number, level: WordKnowledgeLevel) => mutation.mutate({wordId, level}),
    pendingWordId: mutation.isPending ? (mutation.variables?.wordId ?? null) : null,
  }
}
