import {useEffect, useRef, useState, type ReactNode} from 'react'
import type {WordKnowledgeLevel} from '@/features/words/types/wordTypes'
import {
  ACTIVE_LEVELS,
  CEFR_LEVELS,
  LEVEL_LABELS,
  PARKED_LEVEL,
  POS_VALUES,
  WORD_SORT_OPTIONS,
  selectedValues, selectionValue, sortField,
  type KnowledgeFilter, type Selection,
  type CefrLevel,
  type CompletenessFilter,
  type PosValue,
  type SortOption,
} from '@/features/words/model/wordDomain'
import type {Topic} from '@/features/topics/types/topicTypes'
import {WordFilterPanel} from '@/features/words/components/WordFilterPanel'

type Props = {
  collectionTitle?: string
  collectionAction?: ReactNode
  collectionProgress?: ReactNode
  wordSearch: string; setWordSearch: (v: string) => void
  sortBy: SortOption; setSortBy: (v: SortOption) => void
  levelFilter: KnowledgeFilter; setLevelFilter: (v: KnowledgeFilter) => void
  posFilter: Selection<PosValue>; setPosFilter: (v: Selection<PosValue>) => void
  cefrFilter: Selection<CefrLevel>; setCefrFilter: (v: Selection<CefrLevel>) => void
  thenSortBy?: SortOption | null; setThenSortBy?: (v: SortOption | null) => void
  topicFilter?: number[]; setTopicFilter?: (v: number[]) => void
  topics?: Topic[]
  onLearningSort?: () => void
  completeness: CompletenessFilter; setCompleteness: (v: CompletenessFilter) => void
  onReset: () => void
  totalWordsOverall: number; topicTotalCount: number; filteredCount: number
  pageStart: number; pageEnd: number
  levelSummary: Record<WordKnowledgeLevel, number>
  progressLabel?: string
  progressReady?: boolean
}

const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="5.5" cy="5.5" r="4"/><line x1="8.5" y1="8.5" x2="13" y2="13"/>
  </svg>
)

const CloseIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/>
  </svg>
)

const SelectChevron = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 4.5 6 7.5l3-3"/>
  </svg>
)

const SORT_LABELS: Record<SortOption, string> = {
  'level-asc': 'Weak first', 'level-desc': 'Strong first',
  'term-asc': 'A → Z', 'term-desc': 'Z → A',
  'cefr-asc': 'A1 first', 'cefr-desc': 'C2 first',
  'newest': 'Newest', 'oldest': 'Oldest',
}

const POS_LABELS: Record<PosValue, string> = {
  noun: 'Noun', verb: 'Verb', adjective: 'Adj', adverb: 'Adv',
  phrase: 'Phrase', preposition: 'Prep', 'phrasal verb': 'Phr. verb', other: 'Other',
}

function toggleValue<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter(item => item !== value) : [...values, value]
}

export function WordCollectionToolbar({
  collectionTitle = 'All words', collectionAction, collectionProgress,
  wordSearch, setWordSearch, sortBy, setSortBy, levelFilter, setLevelFilter,
  posFilter, setPosFilter, cefrFilter, setCefrFilter, completeness, setCompleteness,
  onReset, topicTotalCount, filteredCount, pageStart, pageEnd, levelSummary, progressLabel = 'Topic progress', progressReady = true,
  thenSortBy = null, setThenSortBy, topicFilter = [], setTopicFilter, topics = [], onLearningSort,
}: Props) {
  const [searchOpen, setSearchOpen] = useState(() => wordSearch !== '')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [topicSearch, setTopicSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const sortDropdownRef = useRef<HTMLDivElement>(null)

  const levels = selectedValues(levelFilter)
  const positions = selectedValues(posFilter)
  const cefrs = selectedValues(cefrFilter)
  const effectiveSortBy = sortBy
  const searchActive = wordSearch.trim() !== ''
  const activeFilterCount = levels.length + positions.length + cefrs.length + topicFilter.length + (completeness !== 'all' ? 1 : 0)
  const hasActiveFilters = activeFilterCount > 0
  const total = topicTotalCount || 1

  function handleSortChange(v: SortOption) {
    setSortBy(v)
    setSortOpen(false)
  }

  function openSearch() { setSearchOpen(true) }
  function closeSearch() { setSearchOpen(false) }

  useEffect(() => {
    if (searchOpen) {
      searchRef.current?.focus({preventScroll: true})
    }
  }, [searchOpen])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (filtersOpen) { setFiltersOpen(false); return }
        if (sortOpen) setSortOpen(false)
        if (searchOpen) closeSearch()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [filtersOpen, searchOpen, sortOpen])

  useEffect(() => {
    if (!sortOpen) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (!sortDropdownRef.current?.contains(target)) {
        setSortOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [sortOpen])

  const showingLabel = pageStart > 0 ? `${pageStart}–${pageEnd}` : '0'
  const formatCount = (count: number) => count.toLocaleString('en-GB')
  const countLabel = searchActive || hasActiveFilters
    ? `${formatCount(filteredCount)} of ${formatCount(topicTotalCount)}`
    : formatCount(topicTotalCount)
  const sortLabel = sortBy === 'level-asc' && thenSortBy === 'cefr-asc'
    ? 'Weak → A1'
    : `${SORT_LABELS[sortBy]}${thenSortBy ? ` → ${SORT_LABELS[thenSortBy]}` : ''}`
  const activeLevels = [...ACTIVE_LEVELS, PARKED_LEVEL].filter(level => levelSummary[level] > 0)
  const legendLevels = activeLevels.filter(level => Math.round(levelSummary[level] / total * 100) > 0)
  const sortOptions = WORD_SORT_OPTIONS
  const appliedFilters = [
    ...levels.map(value => ({key: `level-${value}`, label: LEVEL_LABELS[value], remove: () => setLevelFilter(selectionValue(levels.filter(level => level !== value)) ?? 'all')})),
    ...cefrs.map(value => ({key: `cefr-${value}`, label: value, remove: () => setCefrFilter(selectionValue(cefrs.filter(cefr => cefr !== value)))})),
    ...positions.map(value => ({key: `pos-${value}`, label: POS_LABELS[value], remove: () => setPosFilter(selectionValue(positions.filter(pos => pos !== value)))})),
    ...topicFilter.map(id => ({key: `topic-${id}`, label: topics.find(topic => topic.id === id)?.name ?? `Topic ${id}`, remove: () => setTopicFilter?.(topicFilter.filter(topicId => topicId !== id))})),
    ...(completeness !== 'all' ? [{key: 'completeness', label: completeness === 'complete' ? 'Complete' : 'Incomplete', remove: () => setCompleteness('all')}] : []),
    ...(searchActive ? [{key: 'search', label: `Search: ${wordSearch}`, remove: () => setWordSearch('')}] : []),
  ]

  return (
    <div className="card toolbar-card">
      <div className="toolbar-heading-row">
        <div className="toolbar-list-heading">
          <h1>{collectionTitle}</h1>
          <span className="toolbar-list-count" aria-label={`${filteredCount} matching words out of ${topicTotalCount}`} title={`Showing ${showingLabel} of ${filteredCount} matching words`}>· {countLabel}</span>
        </div>
      </div>

      {collectionProgress}
      {progressReady && <div className="toolbar-knowledge-progress">
        <div className="toolbar-progress-bar" role="progressbar" aria-label={progressLabel}
          aria-valuemin={0} aria-valuemax={topicTotalCount || 1} aria-valuenow={levelSummary[4]}
          aria-valuetext={`${levelSummary[4]} strong words out of ${topicTotalCount}`}>
          {activeLevels.map(level => <div key={level} className={`toolbar-progress-seg level-${level}`} style={{width: `${levelSummary[level] / total * 100}%`}} />)}
        </div>
        <details className="toolbar-progress-details">
          <summary aria-label="Show word counts">
            <span className="toolbar-progress-legend">
              {legendLevels.map(level => <span key={level} className="toolbar-progress-legend-item">
                <span className={`toolbar-progress-dot level-${level}`} />
                <span className="toolbar-progress-legend-label">{LEVEL_LABELS[level]}</span>
                <span className="toolbar-progress-legend-pct">{Math.round(levelSummary[level] / total * 100)}%</span>
              </span>)}
            </span>
            <SelectChevron />
          </summary>
          <div className="toolbar-progress-counts">
            {activeLevels.map(level => <span key={level}>{LEVEL_LABELS[level]}: {formatCount(levelSummary[level])}</span>)}
          </div>
        </details>
      </div>}

      <div className="toolbar-actions-row">
        <div ref={sortDropdownRef} className={`dropdown toolbar-sort-dropdown ${sortOpen ? 'dropdown-open' : ''}`}>
          <button type="button" className="dropdown-trigger toolbar-sort-trigger" onClick={() => setSortOpen(open => !open)}
            aria-haspopup="listbox" aria-expanded={sortOpen} aria-label="Sort words" title={sortLabel}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 13V3m-3 3 3-3 3 3m3-3v10m-3-3 3 3 3-3" />
            </svg>
            <span className="dropdown-trigger-label">{sortLabel}</span>
            <span className={`dropdown-trigger-icon toolbar-sort-trigger-icon ${sortOpen ? 'is-open' : ''}`}><SelectChevron /></span>
          </button>
          {sortOpen && <div className="dropdown-menu toolbar-sort-menu" role="listbox" aria-label="Sort options">
            {sortOptions.map(option => <button key={option} type="button" role="option" aria-selected={effectiveSortBy === option}
              className={`dropdown-option ${effectiveSortBy === option ? 'dropdown-option-active' : ''}`} onClick={() => handleSortChange(option)}>
              <span className="dropdown-option-label">{SORT_LABELS[option]}</span>
              {effectiveSortBy === option ? <span className="dropdown-check">✓</span> : null}
            </button>)}
          </div>}
        </div>
        <div className="toolbar-actions-tools">
          <button type="button" className={`btn btn-ghost toolbar-filter-toggle ${hasActiveFilters || searchActive || filtersOpen ? 'toolbar-filter-toggle-active' : ''}`}
            onClick={() => setFiltersOpen(!filtersOpen)} aria-label="Toggle filters" aria-expanded={filtersOpen}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M2 4h12M2 12h12"/><circle cx="6" cy="4" r="2" fill="var(--surface-2)"/><circle cx="10" cy="12" r="2" fill="var(--surface-2)"/>
            </svg>
            Filters{activeFilterCount + Number(searchActive) > 0 && <span className="toolbar-filter-badge">{activeFilterCount + Number(searchActive)}</span>}
          </button>
          <button type="button"
            className={`btn btn-ghost toolbar-search-toggle ${searchOpen || searchActive ? 'toolbar-search-toggle-active' : ''}`}
            onClick={searchOpen ? closeSearch : openSearch} aria-label="Toggle search" aria-expanded={searchOpen}><SearchIcon /></button>
        </div>
        {collectionAction}
      </div>

      {searchOpen && <div className="toolbar-search-row">
        <input ref={searchRef} className="search-input" type="search" aria-label="Search words"
          placeholder="Search words, translations, examples…"
          value={wordSearch} onChange={event => setWordSearch(event.target.value)} />
        {searchActive && <button type="button" className="btn btn-ghost toolbar-search-close-btn" onClick={() => setWordSearch('')} aria-label="Clear search"><CloseIcon /></button>}
      </div>}

      {/* Filter chips panel */}
      {filtersOpen && (
          <WordFilterPanel onClose={() => setFiltersOpen(false)}>
          <div className="toolbar-filter-panel-header">
            <div className="toolbar-filter-panel-copy">
              <span className="toolbar-filter-panel-title">Filters & sorting</span>
              <span className="toolbar-filter-panel-subtitle">{activeFilterCount > 0 ? `${activeFilterCount} selected` : 'Refine this word list'}</span>
            </div>
            <button type="button" className="btn btn-ghost toolbar-filter-panel-close" onClick={() => setFiltersOpen(false)} aria-label="Close filters">
              <CloseIcon />
            </button>
          </div>
          <div className="toolbar-filter-panel-body">
          <div className="toolbar-sort-summary">{SORT_LABELS[sortBy]}{thenSortBy ? ` → ${SORT_LABELS[thenSortBy]}` : ''} · {filteredCount} matching words</div>
          {appliedFilters.length > 0 && <div className="toolbar-applied-filters" aria-label="Applied filters">
            {appliedFilters.map(filter => <button key={filter.key} type="button" className="toolbar-chip toolbar-chip-active" onClick={filter.remove} aria-label={`Remove ${filter.label} filter`}>{filter.label} ×</button>)}
            <button type="button" className="btn btn-ghost" onClick={onReset}>Clear all</button>
          </div>}
          {setThenSortBy && <div className="toolbar-advanced-sort">
            <label>Sort by<select className="toolbar-control" aria-label="Primary sort" value={sortBy} onChange={event => setSortBy(event.target.value as SortOption)}>
              {sortOptions.map(value => <option key={value} value={value}>{value.startsWith('level') ? 'Knowledge: ' : value.startsWith('cefr') ? 'English level: ' : ''}{SORT_LABELS[value]}</option>)}
            </select></label>
            <label>Then by<select className="toolbar-control" aria-label="Secondary sort" value={thenSortBy ?? 'none'} onChange={event => setThenSortBy(event.target.value === 'none' ? null : event.target.value as SortOption)}>
              <option value="none">Alphabetical tie-break only</option>
              {sortOptions.filter(value => sortField(value) !== sortField(sortBy)).map(value => <option key={value} value={value}>{value.startsWith('level') ? 'Knowledge: ' : value.startsWith('cefr') ? 'English level: ' : ''}{SORT_LABELS[value]}</option>)}
            </select></label>
            {onLearningSort && <button type="button" className="btn btn-ghost toolbar-learning-preset" onClick={onLearningSort}>Weak words, easiest first</button>}
          </div>}
          <p className="toolbar-filter-help">Choose any values within a group. Words must match every selected group.</p>
          <div className="toolbar-filter-group">
            <span className="toolbar-filter-label">Knowledge level</span>
            <div className="toolbar-chips">
              <button
                type="button"
                  className={`toolbar-chip ${levels.length === 0 ? 'toolbar-chip-active' : ''}`}
                onClick={() => setLevelFilter('all')}
              >
                All levels
              </button>
              {ACTIVE_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`toolbar-chip ${levels.includes(level) ? 'toolbar-chip-active' : ''}`}
                  aria-pressed={levels.includes(level)}
                  onClick={() => setLevelFilter(selectionValue(toggleValue(levels, level)) ?? 'all')}
                >
                  {level} {LEVEL_LABELS[level]}
                </button>
              ))}
              <button
                type="button"
                className={`toolbar-chip ${levels.includes(PARKED_LEVEL) ? 'toolbar-chip-active' : ''}`}
                aria-pressed={levels.includes(PARKED_LEVEL)}
                onClick={() => setLevelFilter(selectionValue(toggleValue(levels, PARKED_LEVEL)) ?? 'all')}
              >
                {LEVEL_LABELS[PARKED_LEVEL]}
              </button>
            </div>
          </div>
          <div className="toolbar-filter-group">
            <span className="toolbar-filter-label">Part of speech</span>
            <div className="toolbar-chips">
              {POS_VALUES.map((pos) => (
                <button key={pos} type="button"
                  className={`toolbar-chip ${positions.includes(pos) ? 'toolbar-chip-active' : ''}`}
                  aria-pressed={positions.includes(pos)}
                  onClick={() => setPosFilter(selectionValue(toggleValue(positions, pos)))}>
                  {POS_LABELS[pos]}
                </button>
              ))}
            </div>
          </div>
          <div className="toolbar-filter-group">
            <span className="toolbar-filter-label">CEFR level</span>
            <div className="toolbar-chips">
              {CEFR_LEVELS.map((lvl) => (
                <button key={lvl} type="button"
                  className={`toolbar-chip ${cefrs.includes(lvl) ? 'toolbar-chip-active' : ''}`}
                  aria-pressed={cefrs.includes(lvl)}
                  onClick={() => setCefrFilter(selectionValue(toggleValue(cefrs, lvl)))}>
                  {lvl}
                </button>
              ))}
            </div>
          </div>
          <div className="toolbar-filter-group">
            <span className="toolbar-filter-label">Completeness</span>
            <div className="toolbar-chips">
              {(['all', 'complete', 'incomplete'] as const).map((v) => (
                <button key={v} type="button"
                  className={`toolbar-chip ${completeness === v ? 'toolbar-chip-active' : ''}`}
                  onClick={() => setCompleteness(v)}>
                  {v === 'all' ? 'All' : v === 'complete' ? '✓ Complete' : '⚠ Incomplete'}
                </button>
              ))}
            </div>
          </div>
          {setTopicFilter && topics.length > 0 && <div className="toolbar-filter-group">
            <span className="toolbar-filter-label">Topics</span>
            <details className="toolbar-topic-filter">
              <summary>{topicFilter.length ? `${topicFilter.length} topics selected` : 'All topics'}</summary>
              <input className="search-input" aria-label="Search topics in filters" placeholder="Find a topic…" value={topicSearch} onChange={event => setTopicSearch(event.target.value)} />
              <div className="toolbar-topic-options">
                {topics.filter(topic => topic.name.toLowerCase().includes(topicSearch.trim().toLowerCase())).map(topic => <label key={topic.id}>
                  <input type="checkbox" aria-label={`Topic: ${topic.name}`} checked={topicFilter.includes(topic.id)} onChange={() => setTopicFilter(toggleValue(topicFilter, topic.id))} />{topic.name}
                </label>)}
              </div>
              {topicFilter.length > 0 && <button type="button" className="btn btn-ghost" onClick={() => setTopicFilter([])}>All topics</button>}
            </details>
          </div>}
          </div>
          <div className="toolbar-filter-panel-actions">
            <button type="button" className="btn btn-ghost toolbar-filter-reset" onClick={onReset}>Reset</button>
            <button type="button" className="btn btn-primary toolbar-filter-apply" onClick={() => setFiltersOpen(false)}>Done</button>
          </div>
          </WordFilterPanel>
      )}
    </div>
  )
}
