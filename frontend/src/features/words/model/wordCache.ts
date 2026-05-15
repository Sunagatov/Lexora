import type {QueryClient} from '@tanstack/react-query'
import type {StudyQueue} from '@/features/smart-review/types/studyQueueTypes'
import type {Word, WordKnowledgeLevel} from '@/features/words/types/wordTypes'
import {queryKeys} from '@/app/queryKeys'

const WORD_DEPENDENT_QUERY_KEYS = [
  queryKeys.words,
  queryKeys.topicSidebar,
  queryKeys.stats,
] as const

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

export function replaceWordInLists(queryClient: QueryClient, updated: Word): void {
  queryClient.setQueryData(queryKeys.word(updated.id), updated)
  queryClient.setQueriesData<Word[]>({queryKey: queryKeys.words}, (current = []) =>
    current.map((word) => (word.id === updated.id ? updated : word)),
  )
}

export function removeWordFromLists(queryClient: QueryClient, wordId: number): void {
  queryClient.setQueriesData<Word[]>({queryKey: queryKeys.words}, (current = []) =>
    current.filter((word) => word.id !== wordId),
  )
  queryClient.removeQueries({queryKey: queryKeys.word(wordId)})
}

export function invalidateWordDependencies(
  queryClient: QueryClient,
  extras: readonly (readonly unknown[])[] = [],
): void {
  for (const queryKey of [...WORD_DEPENDENT_QUERY_KEYS, ...extras]) {
    void queryClient.invalidateQueries({queryKey})
  }
}
