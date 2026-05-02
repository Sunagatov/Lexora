import {useEffect, useMemo, useState} from 'react'
import {useSearchParams} from 'react-router-dom'
import type {Word, WordKnowledgeLevel} from '@/features/words/types/wordTypes'
import {
  DEFAULT_WORD_SORT,
  WORD_SORT_OPTIONS,
  CEFR_LEVELS,
  POS_VALUES,
  filterAndSort,
  buildLevelSummary,
  type SortOption,
  type CefrLevel,
  type PosValue,
  type CompletenessFilter,
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

function parsePos(v: string | null): PosValue | null {
  return (POS_VALUES as readonly string[]).includes(v ?? '') ? (v as PosValue) : null
}

function parseCefr(v: string | null): CefrLevel | null {
  return (CEFR_LEVELS as readonly string[]).includes(v ?? '') ? (v as CefrLevel) : null
}

function parseCompleteness(v: string | null): CompletenessFilter {
  return v === 'complete' || v === 'incomplete' ? v : 'all'
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

  const wordSearch    = searchParams.get('search') ?? ''
  const levelFilter   = parseLevel(searchParams.get('level'))
  const posFilter     = parsePos(searchParams.get('pos'))
  const cefrFilter    = parseCefr(searchParams.get('cefr'))
  const completeness  = parseCompleteness(searchParams.get('completeness'))
  const sortBy        = parseSort(searchParams.get('sort'))
  const page          = parsePage(searchParams.get('page'))
  const pageSize      = searchParams.has('pageSize') ? parsePageSize(searchParams.get('pageSize')) : defaultPageSize

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

  const setWordSearch    = (v: string)                     => setParam('search', v || null)
  const setLevelFilter   = (v: 'all' | WordKnowledgeLevel) => setParam('level', v === 'all' ? null : String(v))
  const setPosFilter     = (v: PosValue | null)             => setParam('pos', v)
  const setCefrFilter    = (v: CefrLevel | null)            => setParam('cefr', v)
  const setCompleteness  = (v: CompletenessFilter)          => setParam('completeness', v === 'all' ? null : v)
  const setSortBy        = (v: SortOption)                  => setParam('sort', v === DEFAULT_WORD_SORT ? null : v)
  const setPage          = (p: number)                      => setParam('page', p === 1 ? null : String(p), false)
  const setPageSize      = (n: number)                      => setParam('pageSize', n === defaultPageSize ? null : String(n))
  const resetFilters     = ()                               => { setSearchParams({}, {replace: true}); setFrozenIds(null) }

  const levelSummary  = useMemo(() => buildLevelSummary(topicWords), [topicWords])
  const filteredWords = useMemo(
    () => filterAndSort(topicWords, {search: wordSearch, levelFilter, posFilter, cefrFilter, completeness, sortBy, frozenIds}),
    [topicWords, wordSearch, levelFilter, posFilter, cefrFilter, completeness, sortBy, frozenIds],
  )
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
    wordSearch, setWordSearch, levelFilter, setLevelFilter,
    posFilter, setPosFilter, cefrFilter, setCefrFilter,
    completeness, setCompleteness,
    sortBy, setSortBy,
    frozenIds, setFrozenIds, levelSummary, filteredWords, pageWords,
    page: safePage, totalPages, setPage, pageSize, setPageSize, pageStart, pageEnd, resetFilters,
  }
}
