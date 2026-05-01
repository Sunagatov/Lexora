import {useEffect, useMemo, useState} from 'react'
import {useSearchParams} from 'react-router-dom'
import type {Word, WordKnowledgeLevel} from '@/features/words/types/wordTypes'
import {
  DEFAULT_WORD_SORT,
  WORD_SORT_OPTIONS,
  filterAndSort,
  buildLevelSummary,
  type SortOption,
} from '@/features/words/model/wordDomain'
import {PAGE_SIZES, DEFAULT_PAGE_SIZE} from '@/shared/config/pagination'


function parseLevel(v: string | null): 'all' | WordKnowledgeLevel {
  const n = parseInt(v ?? '', 10)
  return n >= 1 && n <= 5 ? (n as WordKnowledgeLevel) : 'all'
}

function parsePageSize(v: string | null): number {
  const n = parseInt(v ?? '', 10)
  return PAGE_SIZES.includes(n) ? n : DEFAULT_PAGE_SIZE
}

function parsePage(v: string | null): number {
  const n = parseInt(v ?? '', 10)
  return n >= 1 ? n : 1
}

function parseSort(v: string | null): SortOption {
  return WORD_SORT_OPTIONS.includes(v as SortOption) ? (v as SortOption) : DEFAULT_WORD_SORT
}

type UseWordFilterOptions = {
  defaultPageSize?: number
  syncUrl?: boolean
}

export function useWordFilter(topicWords: Word[], options: UseWordFilterOptions = {}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [frozenIds, setFrozenIds]       = useState<number[] | null>(null)
  const syncUrl = options.syncUrl ?? true
  const requestedDefaultPageSize = options.defaultPageSize ?? DEFAULT_PAGE_SIZE
  const defaultPageSize = PAGE_SIZES.includes(requestedDefaultPageSize)
    ? requestedDefaultPageSize
    : DEFAULT_PAGE_SIZE

  const wordSearch  = searchParams.get('search') ?? ''
  const levelFilter = parseLevel(searchParams.get('level'))
  const sortBy      = parseSort(searchParams.get('sort'))
  const page        = parsePage(searchParams.get('page'))
  const pageSize    = searchParams.has('pageSize') ? parsePageSize(searchParams.get('pageSize')) : defaultPageSize

  function setParam(key: string, value: string | null, resetPage = true) {
    if (!syncUrl) {
      if (resetPage) setFrozenIds(null)
      return
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
      if (resetPage) next.delete('page')
      return next
    }, {replace: true})
    if (resetPage) setFrozenIds(null)
  }

  const setWordSearch  = (v: string)                     => setParam('search', v || null)
  const setLevelFilter = (v: 'all' | WordKnowledgeLevel) => setParam('level', v === 'all' ? null : String(v))
  const setSortBy      = (v: SortOption)                 => setParam('sort', v === DEFAULT_WORD_SORT ? null : v)
  const setPage        = (p: number)                     => setParam('page', p === 1 ? null : String(p), false)
  const setPageSize    = (n: number)                     => setParam('pageSize', n === defaultPageSize ? null : String(n))
  const resetFilters   = ()                              => { setSearchParams({}, {replace: true}); setFrozenIds(null) }

  const levelSummary  = useMemo(() => buildLevelSummary(topicWords), [topicWords])
  const filteredWords = useMemo(() => filterAndSort(topicWords, wordSearch, levelFilter, sortBy, frozenIds), [topicWords, wordSearch, levelFilter, sortBy, frozenIds])
  const totalPages    = Math.max(1, Math.ceil(filteredWords.length / pageSize))
  const safePage      = Math.min(page, totalPages)

  useEffect(() => {
    if (!syncUrl) return
    if (safePage === page) return

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (safePage === 1) next.delete('page')
      else next.set('page', String(safePage))
      return next
    }, {replace: true})
  }, [page, safePage, setSearchParams, syncUrl])

  const pageWords     = useMemo(
    () => filteredWords.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filteredWords, safePage, pageSize],
  )
  const pageStart     = pageWords.length > 0 ? (safePage - 1) * pageSize + 1 : 0
  const pageEnd       = pageWords.length > 0 ? pageStart + pageWords.length - 1 : 0

  return {
    wordSearch, setWordSearch, levelFilter, setLevelFilter, sortBy, setSortBy,
    frozenIds, setFrozenIds, levelSummary, filteredWords, pageWords,
    page: safePage, totalPages, setPage, pageSize, setPageSize, pageStart, pageEnd, resetFilters,
  }
}
