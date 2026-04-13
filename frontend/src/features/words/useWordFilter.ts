import {useMemo, useState} from 'react'
import {useSearchParams} from 'react-router-dom'
import type {Word, WordKnowledgeLevel} from '../../shared/types'
import {filterAndSort, buildLevelSummary, type SortOption} from '../../shared/wordDomain'

export const PAGE_SIZES = (import.meta.env.VITE_PAGE_SIZES ?? '10,20,50,100')
  .split(',')
  .map(Number)
  .filter((n) => n > 0)

const DEFAULT_PAGE_SIZE = Number(import.meta.env.VITE_DEFAULT_PAGE_SIZE ?? 20)

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
  const valid: SortOption[] = ['term-asc', 'term-desc', 'level-asc', 'level-desc']
  return valid.includes(v as SortOption) ? (v as SortOption) : 'level-asc'
}

export function useWordFilter(topicWords: Word[]) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [frozenIds, setFrozenIds]       = useState<number[] | null>(null)

  const wordSearch  = searchParams.get('search') ?? ''
  const levelFilter = parseLevel(searchParams.get('level'))
  const sortBy      = parseSort(searchParams.get('sort'))
  const page        = parsePage(searchParams.get('page'))
  const pageSize    = parsePageSize(searchParams.get('pageSize'))

  function setParam(key: string, value: string | null, resetPage = true) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      value === null || value === '' ? next.delete(key) : next.set(key, value)
      if (resetPage) next.delete('page')
      return next
    }, {replace: true})
    if (resetPage) setFrozenIds(null)
  }

  const setWordSearch  = (v: string)                     => setParam('search', v || null)
  const setLevelFilter = (v: 'all' | WordKnowledgeLevel) => setParam('level', v === 'all' ? null : String(v))
  const setSortBy      = (v: SortOption)                 => setParam('sort', v === 'level-asc' ? null : v)
  const setPage        = (p: number)                     => setParam('page', p === 1 ? null : String(p), false)
  const setPageSize    = (n: number)                     => setParam('pageSize', n === DEFAULT_PAGE_SIZE ? null : String(n))
  const resetFilters   = ()                              => { setSearchParams({}, {replace: true}); setFrozenIds(null) }

  const levelSummary  = useMemo(() => buildLevelSummary(topicWords), [topicWords])
  const filteredWords = useMemo(() => filterAndSort(topicWords, wordSearch, levelFilter, sortBy, frozenIds), [topicWords, wordSearch, levelFilter, sortBy, frozenIds])
  const totalPages    = Math.max(1, Math.ceil(filteredWords.length / pageSize))
  const safePage      = Math.min(page, totalPages)
  const pageWords     = useMemo(() => filteredWords.slice((safePage - 1) * pageSize, safePage * pageSize), [filteredWords, safePage, pageSize])
  const pageStart     = pageWords.length > 0 ? (safePage - 1) * pageSize + 1 : 0
  const pageEnd       = pageWords.length > 0 ? pageStart + pageWords.length - 1 : 0

  return {
    wordSearch, setWordSearch, levelFilter, setLevelFilter, sortBy, setSortBy,
    frozenIds, setFrozenIds, levelSummary, filteredWords, pageWords,
    page: safePage, totalPages, setPage, pageSize, setPageSize, pageStart, pageEnd, resetFilters,
  }
}
