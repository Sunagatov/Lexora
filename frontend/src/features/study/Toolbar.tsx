import {useEffect, useRef, useState} from 'react'
import type {WordKnowledgeLevel} from '../../shared/types'
import {ACTIVE_LEVELS, PARKED_LEVEL, LEVEL_LABELS, type SortOption} from '../words/wordDomain'

type Props = {
  wordSearch: string; setWordSearch: (v: string) => void
  sortBy: SortOption; setSortBy: (v: SortOption) => void
  levelFilter: 'all' | WordKnowledgeLevel; setLevelFilter: (v: 'all' | WordKnowledgeLevel) => void
  onReset: () => void
  totalWordsOverall: number; topicTotalCount: number; filteredCount: number
  pageStart: number; pageEnd: number
  levelSummary: Record<WordKnowledgeLevel, number>
  topicName?: string
}

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5.5" cy="5.5" r="4"/>
    <line x1="8.5" y1="8.5" x2="13" y2="13"/>
  </svg>
)

const CloseIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="1" y1="1" x2="11" y2="11"/>
    <line x1="11" y1="1" x2="1" y2="11"/>
  </svg>
)

export function Toolbar({
  wordSearch, setWordSearch, sortBy, setSortBy, levelFilter, setLevelFilter,
  onReset, totalWordsOverall, topicTotalCount, filteredCount, pageStart, pageEnd, levelSummary, topicName,
}: Props) {
  const [searchOpen, setSearchOpen] = useState(() => wordSearch !== '')
  const desktopSearchRef = useRef<HTMLInputElement>(null)
  const mobileSearchRef = useRef<HTMLInputElement>(null)

  const levelActive = levelFilter !== 'all'
  const effectiveSortBy: SortOption = levelActive && (sortBy === 'level-asc' || sortBy === 'level-desc') ? 'term-asc' : sortBy
  const searchActive = wordSearch.trim() !== ''

  function handleSortChange(v: SortOption) {
    setSortBy(v)
    if (levelActive && (v === 'level-asc' || v === 'level-desc')) setSortBy('term-asc')
  }

  function openSearch() { setSearchOpen(true) }
  function closeSearch() { setSearchOpen(false) }

  useEffect(() => {
    if (searchOpen) {
      desktopSearchRef.current?.focus()
      mobileSearchRef.current?.focus()
    }
  }, [searchOpen])

  useEffect(() => {
    if (!searchOpen) return
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') closeSearch() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [searchOpen])

  const showingLabel = pageStart > 0 ? `${pageStart}–${pageEnd}` : '0'
  const isFiltered = filteredCount !== topicTotalCount

  return (
    <div className="card toolbar-card">
      {/* Desktop: search input row */}
      {searchOpen && (
        <div className="toolbar-search-row toolbar-search-row-desktop">
          <input
            ref={desktopSearchRef}
            className="search-input"
            type="text"
            placeholder="Search word, translation, example, notes…"
            value={wordSearch}
            onChange={(e) => setWordSearch(e.target.value)}
          />
          <button type="button" className="btn btn-ghost toolbar-search-close-btn" onClick={closeSearch} aria-label="Close search">
            <CloseIcon />
          </button>
        </div>
      )}

      {/* Mobile: search input row */}
      {searchOpen && (
        <div className="toolbar-mobile-search-row">
          <div className="toolbar-mobile-search-wrap">
            <input
              ref={mobileSearchRef}
              className="search-input toolbar-mobile-search"
              type="text"
              placeholder="Search words…"
              value={wordSearch}
              onChange={(e) => setWordSearch(e.target.value)}
            />
            {wordSearch.trim() && (
              <button type="button" className="toolbar-mobile-clear" aria-label="Clear search" onClick={() => setWordSearch('')}>
                <CloseIcon />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mobile: one row — search | sort | level */}
      <div className="toolbar-mobile-row">
        <button
          type="button"
          className={`btn btn-ghost toolbar-search-toggle ${searchOpen || searchActive ? 'toolbar-search-toggle-active' : ''}`}
          onClick={searchOpen ? closeSearch : openSearch}
          aria-label="Toggle search"
        >
          <SearchIcon />
        </button>
        <select
          className="toolbar-control toolbar-mobile-select"
          value={effectiveSortBy}
          onChange={(e) => handleSortChange(e.target.value as SortOption)}
          aria-label="Sort words"
        >
          {!levelActive && <option value="level-asc">Level ↑</option>}
          {!levelActive && <option value="level-desc">Level ↓</option>}
          <option value="term-asc">A → Z</option>
          <option value="term-desc">Z → A</option>
        </select>
        <select
          className="toolbar-control toolbar-mobile-select"
          value={String(levelFilter)}
          onChange={(e) => setLevelFilter(e.target.value === 'all' ? 'all' : (Number(e.target.value) as WordKnowledgeLevel))}
          aria-label="Filter by level"
        >
          <option value="all">All</option>
          {ACTIVE_LEVELS.map((l) => (
            <option key={l} value={String(l)}>{LEVEL_LABELS[l]}</option>
          ))}
          <option value={String(PARKED_LEVEL)}>{LEVEL_LABELS[PARKED_LEVEL]}</option>
        </select>
      </div>

      {/* Desktop: controls row */}
      <div className="toolbar-controls-row">
        <button
          type="button"
          className={`btn btn-ghost toolbar-search-toggle ${searchOpen || searchActive ? 'toolbar-search-toggle-active' : ''}`}
          onClick={searchOpen ? closeSearch : openSearch}
          aria-label="Toggle search"
        >
          <SearchIcon />
        </button>
        <select
          className="toolbar-control toolbar-control-sort"
          value={effectiveSortBy}
          onChange={(e) => handleSortChange(e.target.value as SortOption)}
          aria-label="Sort words"
        >
          {!levelActive && <option value="level-asc">Level ↑</option>}
          {!levelActive && <option value="level-desc">Level ↓</option>}
          <option value="term-asc">A → Z</option>
          <option value="term-desc">Z → A</option>
        </select>
        <select
          className="toolbar-control toolbar-control-level"
          value={String(levelFilter)}
          onChange={(e) => setLevelFilter(e.target.value === 'all' ? 'all' : (Number(e.target.value) as WordKnowledgeLevel))}
          aria-label="Filter words by level"
        >
          <option value="all">All levels — {topicTotalCount}</option>
          {ACTIVE_LEVELS.map((l) => (
            <option key={l} value={String(l)}>{l} {LEVEL_LABELS[l]} — {levelSummary[l]}</option>
          ))}
          <option value={String(PARKED_LEVEL)}>{LEVEL_LABELS[PARKED_LEVEL]} — {levelSummary[PARKED_LEVEL]}</option>
        </select>
        <button type="button" className="btn btn-ghost toolbar-reset-btn" onClick={onReset}>Reset</button>
      </div>

      <div className="toolbar-meta-row">
        <div className="results-meta">
          <span className="results-meta-item">Showing <strong>{showingLabel}</strong></span>
          {isFiltered && (<><span className="results-meta-separator">·</span><span className="results-meta-item"><strong>{filteredCount}</strong> filtered</span></>)}
          <span className="results-meta-separator">·</span>
          {topicName ? (
            <span className="results-meta-item results-meta-topic" title={topicName}><strong>{topicName}</strong></span>
          ) : (
            <span className="results-meta-item"><strong>{topicTotalCount}</strong> in topic</span>
          )}
          <span className="results-meta-separator results-meta-separator-total">·</span>
          <span className="results-meta-item results-meta-item-total"><strong>{totalWordsOverall}</strong> total</span>
        </div>
      </div>
    </div>
  )
}
