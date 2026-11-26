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

function patchCachedItems<T>(
  items: T[] | undefined,
  matches: (item: T) => boolean,
  update: (item: T) => T,
): T[] | undefined {
  if (!items) return
  const index = items.findIndex(matches)
  if (index < 0) return
  const item = update(items[index])
  if (item === items[index]) return
  const next = items.slice()
  next[index] = item
  return next
}

function patchWordCollections(
  queryClient: QueryClient,
  wordId: number,
  update: (word: Word) => Word,
): void {
  const matches = (word: Word) => word.id === wordId
  // An undefined updater result leaves caches untouched, including their freshness.
  queryClient.setQueriesData<Word[]>({queryKey: queryKeys.words}, current => patchCachedItems(current, matches, update))
  queryClient.setQueriesData<WordListResponse>({queryKey: queryKeys.wordList}, current => {
    const words = patchCachedItems(current?.words, matches, update)
    return current && words ? {...current, words} : undefined
  })
  queryClient.setQueryData<StudyQueue>(queryKeys.smartReview, current => {
    const items = patchCachedItems(current?.items, item => item.word_id === wordId, item => {
      const word = update(item.word)
      return word === item.word ? item : {...item, word}
    })
    return current && items ? {...current, items} : undefined
  })
}

export function patchWordLevel(queryClient: QueryClient, wordId: number, level: WordKnowledgeLevel) {
  patchWordCollections(queryClient, wordId, word => word.knowledge_level === level ? word : {...word, knowledge_level: level})
}

export function patchWordFavorite(queryClient: QueryClient, wordId: number, isFavorite: boolean) {
  const update = (word: Word) => !!word.is_favorite === isFavorite ? word : {...word, is_favorite: isFavorite}
  queryClient.setQueryData<Word>(queryKeys.word(wordId), current =>
    current && !!current.is_favorite !== isFavorite ? update(current) : undefined,
  )
  patchWordCollections(queryClient, wordId, update)
}

export function replaceWordInLists(queryClient: QueryClient, updated: Word): void {
  queryClient.setQueryData(queryKeys.word(updated.id), updated)
  queryClient.setQueryData<StudyQueue>(queryKeys.smartReview, current => current ? {
    ...current,
    items: current.items.map(item => item.word_id === updated.id ? {...item, word: updated} : item),
  } : current)
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
  // Keep the mounted detail query until navigation completes, avoiding a refetch
  // of the word we just deleted. Revisiting its page must still load fresh data.
  queryClient.removeQueries({queryKey: queryKeys.word(wordId), type: 'inactive'})
  void queryClient.invalidateQueries({queryKey: queryKeys.word(wordId), refetchType: 'none'})
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
