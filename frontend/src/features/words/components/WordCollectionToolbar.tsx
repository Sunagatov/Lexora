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

const SelectChevron = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 4.5 6 7.5l3-3"/>
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
  const [sortOpen, setSortOpen] = useState(false)
  const desktopSearchRef = useRef<HTMLInputElement>(null)
  const mobileSearchRef = useRef<HTMLInputElement>(null)
  const desktopSortDropdownRef = useRef<HTMLDivElement>(null)
  const mobileSortDropdownRef = useRef<HTMLDivElement>(null)

  const levelActive = levelFilter !== 'all'
  const effectiveSortBy: SortOption = levelActive && isLevelSortOption(sortBy) ? FALLBACK_TERM_SORT : sortBy
  const searchActive = wordSearch.trim() !== ''
  const hasActiveFilters = levelFilter !== 'all' || posFilter !== null || cefrFilter !== null || completeness !== 'all'
  const hasAnyActiveControls = searchActive || hasActiveFilters
  const activeFilterCount = (levelFilter !== 'all' ? 1 : 0) + (posFilter ? 1 : 0) + (cefrFilter ? 1 : 0) + (completeness !== 'all' ? 1 : 0)
  const total = topicTotalCount || 1
  const masteredPct = Math.round((levelSummary[4] / total) * 100)

  function handleSortChange(v: SortOption) {
    if (levelActive && isLevelSortOption(v)) { setSortBy(FALLBACK_TERM_SORT); return }
    setSortBy(v)
    setSortOpen(false)
  }

  function openSearch() { setSearchOpen(true) }
  function closeSearch() { setSearchOpen(false) }

  useEffect(() => {
    if (searchOpen) { desktopSearchRef.current?.focus(); mobileSearchRef.current?.focus() }
  }, [searchOpen])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (sortOpen) setSortOpen(false)
        if (searchOpen) closeSearch()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [searchOpen, sortOpen])

  useEffect(() => {
    if (!sortOpen) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      const insideDesktop = !!desktopSortDropdownRef.current?.contains(target)
      const insideMobile = !!mobileSortDropdownRef.current?.contains(target)
      if (!insideDesktop && !insideMobile) {
        setSortOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [sortOpen])

  const showingLabel = pageStart > 0 ? `${pageStart}–${pageEnd}` : '0'
  const sortOptions = [
    ...(!levelActive ? LEVEL_SORT_OPTIONS : []),
    ...TERM_SORT_OPTIONS,
    ...CEFR_SORT_OPTIONS,
    ...DATE_SORT_OPTIONS,
  ] as SortOption[]

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
        <div
          ref={mobileSortDropdownRef}
          className={`dropdown toolbar-sort-dropdown toolbar-mobile-select-wrap ${sortOpen ? 'dropdown-open' : ''}`}
        >
          <button
            type="button"
            className="dropdown-trigger toolbar-sort-trigger toolbar-sort-trigger-mobile"
            onClick={() => setSortOpen((open) => !open)}
            aria-haspopup="listbox"
            aria-expanded={sortOpen}
            aria-label="Sort words"
          >
            <span className="dropdown-trigger-label">{SORT_LABELS[effectiveSortBy]}</span>
            <span className={`dropdown-trigger-icon toolbar-sort-trigger-icon ${sortOpen ? 'is-open' : ''}`}><SelectChevron /></span>
          </button>
          {sortOpen && (
            <div className="dropdown-menu toolbar-sort-menu" role="listbox" aria-label="Sort options">
              {sortOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={effectiveSortBy === option}
                  className={`dropdown-option ${effectiveSortBy === option ? 'dropdown-option-active' : ''}`}
                  onClick={() => handleSortChange(option)}
                >
                  <span className="dropdown-option-label">{SORT_LABELS[option]}</span>
                  {effectiveSortBy === option ? <span className="dropdown-check">✓</span> : null}
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button"
          className={`btn btn-ghost toolbar-filter-toggle ${hasActiveFilters || filtersOpen ? 'toolbar-filter-toggle-active' : ''}`}
          onClick={() => setFiltersOpen(!filtersOpen)} aria-label="Toggle filters">
          ☰{activeFilterCount > 0 && <span className="toolbar-filter-badge">{activeFilterCount}</span>}
        </button>
      </div>

      {/* Mobile progress */}
      <div className="toolbar-mobile-progress">
        <div className="toolbar-progress-bar">
          {ACTIVE_LEVELS.map((l) => {
            const pct = (levelSummary[l] / total) * 100
            if (pct === 0) return null
            return <div key={l} className={`toolbar-progress-seg level-${l}`} style={{width: `${pct}%`}} />
          })}
          {!!levelSummary[PARKED_LEVEL] && (
            <div className="toolbar-progress-seg level-5" style={{width: `${(levelSummary[PARKED_LEVEL] / total) * 100}%`}} />
          )}
        </div>
        <div className="toolbar-progress-legend">
          {ACTIVE_LEVELS.map((l) => {
            const pct = Math.round((levelSummary[l] / total) * 100)
            if (pct === 0) return null
            return (
              <span key={l} className="toolbar-progress-legend-item">
                <span className={`toolbar-progress-dot level-${l}`} />
                <span className="toolbar-progress-legend-label">{LEVEL_LABELS[l]}</span>
                <span className="toolbar-progress-legend-pct">{pct}%</span>
              </span>
            )
          })}
          {!!levelSummary[PARKED_LEVEL] && (
            <span className="toolbar-progress-legend-item">
              <span className="toolbar-progress-dot level-5" />
              <span className="toolbar-progress-legend-label">{LEVEL_LABELS[5]}</span>
              <span className="toolbar-progress-legend-pct">{Math.round((levelSummary[PARKED_LEVEL] / total) * 100)}%</span>
            </span>
          )}
        </div>
      </div>

      {/* Desktop controls row */}
      <div className="toolbar-controls-row">
        <button type="button"
          className={`btn btn-ghost toolbar-search-toggle ${searchOpen || searchActive ? 'toolbar-search-toggle-active' : ''}`}
          onClick={searchOpen ? closeSearch : openSearch} aria-label="Toggle search"><SearchIcon /></button>
        <div
          ref={desktopSortDropdownRef}
          className={`dropdown toolbar-sort-dropdown toolbar-control-sort ${sortOpen ? 'dropdown-open' : ''}`}
        >
          <button
            type="button"
            className="dropdown-trigger toolbar-sort-trigger"
            onClick={() => setSortOpen((open) => !open)}
            aria-haspopup="listbox"
            aria-expanded={sortOpen}
            aria-label="Sort words"
          >
            <span className="dropdown-trigger-label">{SORT_LABELS[effectiveSortBy]}</span>
            <span className={`dropdown-trigger-icon toolbar-sort-trigger-icon ${sortOpen ? 'is-open' : ''}`}><SelectChevron /></span>
          </button>
          {sortOpen && (
            <div className="dropdown-menu toolbar-sort-menu" role="listbox" aria-label="Sort options">
              {sortOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={effectiveSortBy === option}
                  className={`dropdown-option ${effectiveSortBy === option ? 'dropdown-option-active' : ''}`}
                  onClick={() => handleSortChange(option)}
                >
                  <span className="dropdown-option-label">{SORT_LABELS[option]}</span>
                  {effectiveSortBy === option ? <span className="dropdown-check">✓</span> : null}
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button"
          className={`btn btn-ghost toolbar-filter-toggle ${hasActiveFilters || filtersOpen ? 'toolbar-filter-toggle-active' : ''}`}
          onClick={() => setFiltersOpen(!filtersOpen)} aria-label="Toggle filters">
          Filters{activeFilterCount > 0 && <span className="toolbar-filter-badge">{activeFilterCount}</span>}
        </button>
        <button
          type="button"
          className={`btn btn-ghost toolbar-reset-btn${hasAnyActiveControls ? '' : ' is-inactive'}`}
          onClick={onReset}
        >
          Reset
        </button>
        <div className="toolbar-progress" aria-label={`Topic progress, ${masteredPct}% mastered`}>
          <div className="toolbar-progress-bar">
            {ACTIVE_LEVELS.map((l) => {
              const pct = (levelSummary[l] / total) * 100
              if (pct === 0) return null
              return <div key={l} className={`toolbar-progress-seg level-${l}`} style={{width: `${pct}%`}} />
            })}
            {!!levelSummary[PARKED_LEVEL] && (
              <div
                className="toolbar-progress-seg level-5"
                style={{width: `${(levelSummary[PARKED_LEVEL] / total) * 100}%`}}
              />
            )}
          </div>
          <div className="toolbar-progress-legend">
            {ACTIVE_LEVELS.map((l) => {
              const pct = Math.round((levelSummary[l] / total) * 100)
              if (pct === 0) return null
              return (
                <span key={l} className="toolbar-progress-legend-item">
                  <span className={`toolbar-progress-dot level-${l}`} />
                  <span className="toolbar-progress-legend-label">{LEVEL_LABELS[l]}</span>
                  <span className="toolbar-progress-legend-pct">{pct}%</span>
                </span>
              )
            })}
            {!!levelSummary[PARKED_LEVEL] && (
              <span className="toolbar-progress-legend-item">
                <span className="toolbar-progress-dot level-5" />
                <span className="toolbar-progress-legend-label">{LEVEL_LABELS[5]}</span>
                <span className="toolbar-progress-legend-pct">{Math.round((levelSummary[PARKED_LEVEL] / total) * 100)}%</span>
              </span>
            )}
          </div>
        </div>
        <span className="toolbar-range">{showingLabel} of {filteredCount}</span>
      </div>

      {/* Filter chips panel */}
      {filtersOpen && (
          <div className="toolbar-filter-panel">
          <div className="toolbar-filter-panel-header">
            <div className="toolbar-filter-panel-copy">
              <span className="toolbar-filter-panel-title">Filters</span>
              <span className="toolbar-filter-panel-subtitle">{activeFilterCount > 0 ? `${activeFilterCount} active` : 'Refine this topic view'}</span>
            </div>
            <button type="button" className="btn btn-ghost toolbar-filter-panel-close" onClick={() => setFiltersOpen(false)} aria-label="Close filters">
              <CloseIcon />
            </button>
          </div>
          <div className="toolbar-filter-group">
            <span className="toolbar-filter-label">Knowledge level</span>
            <div className="toolbar-chips">
              <button
                type="button"
                className={`toolbar-chip ${levelFilter === 'all' ? 'toolbar-chip-active' : ''}`}
                onClick={() => setLevelFilter('all')}
              >
                All levels
              </button>
              {ACTIVE_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`toolbar-chip ${levelFilter === level ? 'toolbar-chip-active' : ''}`}
                  onClick={() => setLevelFilter(level)}
                >
                  {level} {LEVEL_LABELS[level]}
                </button>
              ))}
              <button
                type="button"
                className={`toolbar-chip ${levelFilter === PARKED_LEVEL ? 'toolbar-chip-active' : ''}`}
                onClick={() => setLevelFilter(PARKED_LEVEL)}
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
          <div className="toolbar-filter-panel-actions">
            <button type="button" className="btn btn-ghost toolbar-filter-reset" onClick={onReset}>Reset</button>
            <button type="button" className="btn btn-primary toolbar-filter-apply" onClick={() => setFiltersOpen(false)}>Done</button>
          </div>
          </div>
      )}
    </div>
  )
}
