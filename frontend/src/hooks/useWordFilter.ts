import {useEffect, useMemo, useState} from 'react'
import type {Word, WordKnowledgeLevel} from '../lib/api'
import {filterAndSort, buildLevelSummary, type SortOption} from '../lib/words'

export function useWordFilter(topicWords: Word[], pageSize: number, selectedTopicId: number | null) {
  const [wordSearch, setWordSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<'all' | WordKnowledgeLevel>('all')
  const [sortBy, setSortBy]           = useState<SortOption>('level-asc')
  const [frozenIds, setFrozenIds]     = useState<number[] | null>(null)
  const [page, setPage]               = useState(1)

  useEffect(() => {
    setFrozenIds(null)
    setPage(1)
  }, [selectedTopicId, wordSearch, levelFilter, sortBy])

  const levelSummary  = useMemo(() => buildLevelSummary(topicWords), [topicWords])

  const filteredWords = useMemo(
    () => filterAndSort(topicWords, wordSearch, levelFilter, sortBy, frozenIds),
    [topicWords, wordSearch, levelFilter, sortBy, frozenIds],
  )

  const totalPages = Math.max(1, Math.ceil(filteredWords.length / pageSize))
  const safePage   = Math.min(page, totalPages)

  const pageWords = useMemo(
    () => filteredWords.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filteredWords, safePage, pageSize],
  )

  const pageStart = pageWords.length > 0 ? (safePage - 1) * pageSize + 1 : 0
  const pageEnd   = pageWords.length > 0 ? pageStart + pageWords.length - 1 : 0

  const resetFilters = () => {
    setWordSearch('')
    setLevelFilter('all')
    setSortBy('level-asc')
  }

  return {
    wordSearch, setWordSearch,
    levelFilter, setLevelFilter,
    sortBy, setSortBy,
    frozenIds, setFrozenIds,
    levelSummary,
    filteredWords,
    pageWords,
    page: safePage,
    totalPages,
    setPage,
    pageStart,
    pageEnd,
    resetFilters,
  }
}
