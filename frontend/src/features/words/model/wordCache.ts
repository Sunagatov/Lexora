import type {QueryClient} from '@tanstack/react-query'
import type {StudyQueue} from '@/features/smart-review/types/studyQueueTypes'
import type {Word, WordKnowledgeLevel} from '@/features/words/types/wordTypes'
import {queryKeys} from '@/app/queryKeys'

export function patchWordLevel(
  queryClient: QueryClient,
  wordId: number,
  level: WordKnowledgeLevel,
): void {
  queryClient.setQueriesData<Word[]>({queryKey: queryKeys.words}, (cur = []) =>
    cur.map((w) => w.id === wordId ? {...w, knowledge_level: level} : w),
  )
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
}
