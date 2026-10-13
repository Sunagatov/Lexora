import {useSearchParams} from 'react-router-dom'
import {PAGE_SIZES, DEFAULT_PAGE_SIZE} from '@/shared/config/pagination'
import {CEFR_LEVELS, POS_VALUES, LEVELS, WORD_SORT_OPTIONS, parseSelection, parseSecondarySort,
  type SortOption, type KnowledgeFilter, type Selection, type CefrLevel, type PosValue, type CompletenessFilter} from '@/features/words/model/wordDomain'

type Options = {defaultPageSize?: number; syncUrl?: boolean; onControlsChange?: () => void}

export function useWordFilterControls(options: Options = {}) {
  const [params, setParams] = useSearchParams()
  const defaultSize = options.defaultPageSize ?? DEFAULT_PAGE_SIZE
  const wordSearch = params.get('search') ?? ''
  const levelFilter: KnowledgeFilter = parseSelection(params.get('level'), LEVELS) ?? 'all'
  const posFilter = parseSelection(params.get('pos'), POS_VALUES)
  const cefrFilter = parseSelection(params.get('cefr'), CEFR_LEVELS)
  const rawSort = params.get('sort') as SortOption
  const sortBy = WORD_SORT_OPTIONS.includes(rawSort) ? rawSort : 'level-asc'
  const thenSortBy = parseSecondarySort(params.get('thenSort'), sortBy)
  const topicFilter = [...new Set((params.get('topics') ?? '').split(',').map(Number).filter(id => Number.isInteger(id) && id > 0))]
  const rawCompleteness = params.get('completeness')
  const completeness: CompletenessFilter = rawCompleteness === 'complete' || rawCompleteness === 'incomplete' ? rawCompleteness : 'all'
  const rawPage = Number(params.get('page'))
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1
  const rawSize = Number(params.get('pageSize'))
  const pageSize = PAGE_SIZES.includes(rawSize) && rawSize <= 100 ? rawSize : defaultSize

  function setParam(key: string, value: string | null, resetPage = true) {
    if (options.syncUrl === false) return
    setParams(prev => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      if (resetPage) next.delete('page')
      return next
    }, {replace: true})
    if (resetPage) options.onControlsChange?.()
  }
  function serialize(value: Selection<string | number> | 'all') {
    return value === null || value === 'all' ? null : String(value)
  }
  function setLearningSort() {
    setParams(prev => {
      const next = new URLSearchParams(prev)
      next.delete('sort'); next.delete('thenSort'); next.delete('page')
      return next
    }, {replace: true})
    options.onControlsChange?.()
  }
  return {
    wordSearch, setWordSearch: (value: string) => setParam('search', value),
    levelFilter, setLevelFilter: (value: KnowledgeFilter) => setParam('level', serialize(value)),
    posFilter, setPosFilter: (value: Selection<PosValue>) => setParam('pos', serialize(value)),
    cefrFilter, setCefrFilter: (value: Selection<CefrLevel>) => setParam('cefr', serialize(value)),
    topicFilter, setTopicFilter: (value: number[]) => setParam('topics', value.join(',')),
    sortBy, setSortBy: (value: SortOption) => setParam('sort', value === 'level-asc' ? null : value),
    thenSortBy, setThenSortBy: (value: SortOption | null) => setParam('thenSort', value === 'cefr-asc' ? null : value ?? 'none'),
    completeness, setCompleteness: (value: CompletenessFilter) => setParam('completeness', value === 'all' ? null : value),
    page, setPage: (value: number) => setParam('page', value === 1 ? null : String(value), false),
    pageSize, setPageSize: (value: number) => setParam('pageSize', value === defaultSize ? null : String(value)),
    setLearningSort,
    resetFilters: () => { setParams({}, {replace: true}); options.onControlsChange?.() },
  }
}
