import {useEffect, useMemo, useState} from 'react'
import type {Word} from '@/features/words/types/wordTypes'
import type {Topic} from '@/features/topics/types/topicTypes'
import {filterAndSort, buildLevelSummary} from '@/features/words/model/wordDomain'
import {topicContainsWordThroughSubtree} from '@/features/words/model/wordPageContext'
import {useWordFilterControls} from '@/features/words/hooks/useWordFilterControls'

type Options = {defaultPageSize?: number; syncUrl?: boolean; isLoading?: boolean; topics?: Topic[]}
const EMPTY_TOPICS: Topic[] = []
export function useWordFilter(topicWords: Word[], options: Options = {}) {
  const [frozenIds, setFrozenIds] = useState<number[] | null>(null)
  const controls = useWordFilterControls({...options, onControlsChange: () => setFrozenIds(null)})
  const {wordSearch, levelFilter, posFilter, cefrFilter, completeness, sortBy, thenSortBy, topicFilter, page, pageSize, setPage} = controls
  const topics = options.topics ?? EMPTY_TOPICS
  const topicIds = useMemo(() => topicFilter.length ? [...new Set([...topicFilter,
    ...topics.filter(topic => topicFilter.some(id => topicContainsWordThroughSubtree(id, [topic.id], topics))).map(topic => topic.id),
  ])] : [], [topicFilter, topics])
  const levelSummary = useMemo(() => buildLevelSummary(topicWords), [topicWords])
  const filteredWords = useMemo(() => filterAndSort(topicWords, {
    search: wordSearch, levelFilter, posFilter, cefrFilter, completeness, sortBy, thenSortBy, topicIds, frozenIds,
  }), [topicWords, wordSearch, levelFilter, posFilter, cefrFilter, completeness, sortBy, thenSortBy, topicIds, frozenIds])
  const totalPages = Math.max(1, Math.ceil(filteredWords.length / pageSize))
  const safePage = Math.min(page, totalPages)
  useEffect(() => {
    if (options.syncUrl !== false && !options.isLoading && safePage !== page) setPage(safePage)
  }, [page, safePage, setPage, options.syncUrl, options.isLoading])
  const pageWords = useMemo(() => filteredWords.slice((safePage - 1) * pageSize, safePage * pageSize), [filteredWords, safePage, pageSize])
  const pageStart = pageWords.length ? (safePage - 1) * pageSize + 1 : 0
  const pageEnd = pageWords.length ? pageStart + pageWords.length - 1 : 0
  return {...controls, frozenIds, setFrozenIds, levelSummary, filteredWords, pageWords, page: safePage, totalPages, pageStart, pageEnd}
}
