import {useEffect, useRef, useState} from 'react'
import type {WordKnowledgeLevel} from '@/features/words/types/wordTypes'
import {
  ACTIVE_LEVELS,
  CEFR_LEVELS,
  CEFR_SORT_OPTIONS,
  DATE_SORT_OPTIONS,
  LEVEL_LABELS,
  LEVEL_SORT_OPTIONS,
  PARKED_LEVEL,
  POS_VALUES,
  TERM_SORT_OPTIONS,
  type CefrLevel,
  type CompletenessFilter,
  type PosValue,
  type SortOption,
} from '@/features/words/model/wordDomain'

type Props = {
  wordSearch: string; setWordSearch: (v: string) => void
  sortBy: SortOption; setSortBy: (v: SortOption) => void
  levelFilter: 'all' | WordKnowledgeLevel; setLevelFilter: (v: 'all' | WordKnowledgeLevel) => void
  posFilter: PosValue | null; setPosFilter: (v: PosValue | null) => void
  cefrFilter: CefrLevel | null; setCefrFilter: (v: CefrLevel | null) => void
  completeness: CompletenessFilter; setCompleteness: (v: CompletenessFilter) => void
  onReset: () => void
  totalWordsOverall: number; topicTotalCount: number; filteredCount: number
  pageStart: number; pageEnd: number
  levelSummary: Record<WordKnowledgeLevel, number>
  topicName?: string
}

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5.5" cy="5.5" r="4"/><line x1="8.5" y1="8.5" x2="13" y2="13"/>
  </svg>
)

const CloseIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/>
  </svg>
)

const SORT_LABELS: Record<SortOption, string> = {
  'level-asc': 'Level ↑', 'level-desc': 'Level ↓',
  'term-asc': 'A → Z', 'term-desc': 'Z → A',
  'cefr-asc': 'CEFR ↑', 'cefr-desc': 'CEFR ↓',
  'newest': 'Newest', 'oldest': 'Oldest',
}

const POS_LABELS: Record<PosValue, string> = {
  noun: 'Noun', verb: 'Verb', adjective: 'Adj', adverb: 'Adv',
  phrase: 'Phrase', preposition: 'Prep', 'phrasal verb': 'Phr. verb', other: 'Other',
}

const FALLBACK_TERM_SORT = TERM_SORT_OPTIONS[0]
const LEVEL_SORT_SET = new Set<SortOption>(LEVEL_SORT_OPTIONS)

function isLevelSortOption(value: SortOption): value is (typeof LEVEL_SORT_OPTIONS)[number] {
  return LEVEL_SORT_SET.has(value)
}

export function WordCollectionToolbar({
  wordSearch, setWordSearch, sortBy, setSortBy, levelFilter, setLevelFilter,
  posFilter, setPosFilter, cefrFilter, setCefrFilter, completeness, setCompleteness,
  onReset, topicTotalCount, filteredCount, pageStart, pageEnd, levelSummary,
}: Props) {
  const [searchOpen, setSearchOpen] = useState(() => wordSearch !== '')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const desktopSearchRef = useRef<HTMLInputElement>(null)
  const mobileSearchRef = useRef<HTMLInputElement>(null)

  const levelActive = levelFilter !== 'all'
  const effectiveSortBy: SortOption = levelActive && isLevelSortOption(sortBy) ? FALLBACK_TERM_SORT : sortBy
  const searchActive = wordSearch.trim() !== ''
  const hasActiveFilters = posFilter !== null || cefrFilter !== null || completeness !== 'all'
  const activeFilterCount = (posFilter ? 1 : 0) + (cefrFilter ? 1 : 0) + (completeness !== 'all' ? 1 : 0)

  function handleSortChange(v: SortOption) {
    if (levelActive && isLevelSortOption(v)) { setSortBy(FALLBACK_TERM_SORT); return }
    setSortBy(v)
  }

  function openSearch() { setSearchOpen(true) }
  function closeSearch() { setSearchOpen(false) }

  useEffect(() => {
    if (searchOpen) { desktopSearchRef.current?.focus(); mobileSearchRef.current?.focus() }
  }, [searchOpen])

  useEffect(() => {
    if (!searchOpen) return
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') closeSearch() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [searchOpen])

  const showingLabel = pageStart > 0 ? `${pageStart}–${pageEnd}` : '0'

  return (
    <div className="card toolbar-card">
      {/* Search row — desktop */}
      {searchOpen && (
        <div className="toolbar-search-row toolbar-search-row-desktop">
          <input ref={desktopSearchRef} className="search-input" type="text"
            placeholder="Search word, translation, definition, example, notes…"
            value={wordSearch} onChange={(e) => setWordSearch(e.target.value)} />
          <button type="button" className="btn btn-ghost toolbar-search-close-btn" onClick={closeSearch} aria-label="Close search"><CloseIcon /></button>
        </div>
      )}

      {/* Search row — mobile */}
      {searchOpen && (
        <div className="toolbar-mobile-search-row">
          <div className="toolbar-mobile-search-wrap">
            <input ref={mobileSearchRef} className="search-input toolbar-mobile-search" type="text"
              placeholder="Search words…" value={wordSearch} onChange={(e) => setWordSearch(e.target.value)} />
            {wordSearch.trim() && (
              <button type="button" className="toolbar-mobile-clear" aria-label="Clear search" onClick={() => setWordSearch('')}><CloseIcon /></button>
            )}
          </div>
        </div>
      )}

      {/* Mobile row */}
      <div className="toolbar-mobile-row">
        <button type="button"
          className={`btn btn-ghost toolbar-search-toggle ${searchOpen || searchActive ? 'toolbar-search-toggle-active' : ''}`}
          onClick={searchOpen ? closeSearch : openSearch} aria-label="Toggle search"><SearchIcon /></button>
        <select className="toolbar-control toolbar-mobile-select" value={effectiveSortBy}
          onChange={(e) => handleSortChange(e.target.value as SortOption)} aria-label="Sort words">
          {!levelActive && LEVEL_SORT_OPTIONS.map((o) => <option key={o} value={o}>{SORT_LABELS[o]}</option>)}
          {TERM_SORT_OPTIONS.map((o) => <option key={o} value={o}>{SORT_LABELS[o]}</option>)}
          {CEFR_SORT_OPTIONS.map((o) => <option key={o} value={o}>{SORT_LABELS[o]}</option>)}
          {DATE_SORT_OPTIONS.map((o) => <option key={o} value={o}>{SORT_LABELS[o]}</option>)}
        </select>
        <select className="toolbar-control toolbar-mobile-select" value={String(levelFilter)}
          onChange={(e) => setLevelFilter(e.target.value === 'all' ? 'all' : (Number(e.target.value) as WordKnowledgeLevel))} aria-label="Filter by level">
          <option value="all">All</option>
          {ACTIVE_LEVELS.map((l) => <option key={l} value={String(l)}>{LEVEL_LABELS[l]}</option>)}
          <option value={String(PARKED_LEVEL)}>{LEVEL_LABELS[PARKED_LEVEL]}</option>
        </select>
        <button type="button"
          className={`btn btn-ghost toolbar-filter-toggle ${hasActiveFilters ? 'toolbar-filter-toggle-active' : ''}`}
          onClick={() => setFiltersOpen(!filtersOpen)} aria-label="Toggle filters">
          ☰{activeFilterCount > 0 && <span className="toolbar-filter-badge">{activeFilterCount}</span>}
        </button>
      </div>

      {/* Desktop controls row */}
      <div className="toolbar-controls-row">
        <button type="button"
          className={`btn btn-ghost toolbar-search-toggle ${searchOpen || searchActive ? 'toolbar-search-toggle-active' : ''}`}
          onClick={searchOpen ? closeSearch : openSearch} aria-label="Toggle search"><SearchIcon /></button>
        <select className="toolbar-control toolbar-control-sort" value={effectiveSortBy}
          onChange={(e) => handleSortChange(e.target.value as SortOption)} aria-label="Sort words">
          {!levelActive && LEVEL_SORT_OPTIONS.map((o) => <option key={o} value={o}>{SORT_LABELS[o]}</option>)}
          {TERM_SORT_OPTIONS.map((o) => <option key={o} value={o}>{SORT_LABELS[o]}</option>)}
          {CEFR_SORT_OPTIONS.map((o) => <option key={o} value={o}>{SORT_LABELS[o]}</option>)}
          {DATE_SORT_OPTIONS.map((o) => <option key={o} value={o}>{SORT_LABELS[o]}</option>)}
        </select>
        <select className="toolbar-control toolbar-control-level" value={String(levelFilter)}
          onChange={(e) => setLevelFilter(e.target.value === 'all' ? 'all' : (Number(e.target.value) as WordKnowledgeLevel))} aria-label="Filter words by level">
          <option value="all">All levels — {topicTotalCount}</option>
          {ACTIVE_LEVELS.map((l) => <option key={l} value={String(l)}>{l} {LEVEL_LABELS[l]} — {levelSummary[l]}</option>)}
          <option value={String(PARKED_LEVEL)}>{LEVEL_LABELS[PARKED_LEVEL]} — {levelSummary[PARKED_LEVEL]}</option>
        </select>
        <button type="button"
          className={`btn btn-ghost toolbar-filter-toggle ${hasActiveFilters || filtersOpen ? 'toolbar-filter-toggle-active' : ''}`}
          onClick={() => setFiltersOpen(!filtersOpen)} aria-label="Toggle filters">
          Filters{activeFilterCount > 0 && <span className="toolbar-filter-badge">{activeFilterCount}</span>}
        </button>
        <button type="button" className="btn btn-ghost toolbar-reset-btn" onClick={onReset}>Reset</button>
        <span className="toolbar-range">{showingLabel} of {filteredCount}</span>
      </div>

      {/* Filter chips panel */}
      {filtersOpen && (
        <div className="toolbar-filter-panel">
          <div className="toolbar-filter-group">
            <span className="toolbar-filter-label">Part of speech</span>
            <div className="toolbar-chips">
              {POS_VALUES.map((pos) => (
                <button key={pos} type="button"
                  className={`toolbar-chip ${posFilter === pos ? 'toolbar-chip-active' : ''}`}
                  onClick={() => setPosFilter(posFilter === pos ? null : pos)}>
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
                  className={`toolbar-chip ${cefrFilter === lvl ? 'toolbar-chip-active' : ''}`}
                  onClick={() => setCefrFilter(cefrFilter === lvl ? null : lvl)}>
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
        </div>
      )}
    </div>
  )
}
