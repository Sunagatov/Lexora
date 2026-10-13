import type {QueryClient} from '@tanstack/react-query'
import type {StudyQueue} from '@/features/smart-review/types/studyQueueTypes'
import type {Word, WordKnowledgeLevel} from '@/features/words/types/wordTypes'
import type {WordListResponse} from '@/features/words/api/wordsApi'
import {queryKeys} from '@/app/queryKeys'

const WORD_DEPENDENT_QUERY_KEYS = [
  queryKeys.words,
  queryKeys.wordList,
  queryKeys.wordSummary,
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
  queryClient.setQueriesData<WordListResponse>({queryKey: queryKeys.wordList}, current =>
    current ? {...current, words: current.words.map(word => word.id === wordId ? {...word, knowledge_level: level} : word)} : current,
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
  queryClient.setQueriesData<WordListResponse>({queryKey: queryKeys.wordList}, current =>
    current ? {...current, words: current.words.map(word => word.id === updated.id ? updated : word)} : current,
  )
}

export function removeWordFromLists(queryClient: QueryClient, wordId: number): void {
  queryClient.setQueriesData<Word[]>({queryKey: queryKeys.words}, (current = []) =>
    current.filter((word) => word.id !== wordId),
  )
  queryClient.setQueriesData<WordListResponse>({queryKey: queryKeys.wordList}, current =>
    current ? {...current, words: current.words.filter(word => word.id !== wordId)} : current,
  )
  queryClient.removeQueries({queryKey: queryKeys.word(wordId)})
}

export function invalidateWordDependencies(
  queryClient: QueryClient,
  extras: readonly (readonly unknown[])[] = [],
  options: {preserveWordPages?: boolean} = {},
): void {
  // Other edits/deletes must load fresh pages when returning to an inactive list.
  if (!options.preserveWordPages) queryClient.removeQueries({queryKey: queryKeys.wordList, type: 'inactive'})
  for (const queryKey of [...WORD_DEPENDENT_QUERY_KEYS, ...extras]) {
    void queryClient.invalidateQueries(options.preserveWordPages && queryKey === queryKeys.wordList
      ? {queryKey, refetchType: 'none'} : {queryKey})
  }
}
