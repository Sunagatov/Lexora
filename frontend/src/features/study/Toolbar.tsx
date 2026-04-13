import {useState} from 'react'
import type {WordKnowledgeLevel} from '../../shared/http'
import {ACTIVE_LEVELS, PARKED_LEVEL, LEVEL_LABELS, type SortOption} from '../../shared/wordDomain'

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

export function Toolbar({
  wordSearch, setWordSearch, sortBy, setSortBy, levelFilter, setLevelFilter,
  onReset, totalWordsOverall, topicTotalCount, filteredCount, pageStart, pageEnd, levelSummary, topicName,
}: Props) {
  const [searchOpen, setSearchOpen] = useState(false)
  const levelActive   = levelFilter !== 'all'
  // When a level filter is active, level-based sort options are hidden.
  // Clamp the displayed sort value synchronously so the select never shows a blank option.
  const effectiveSortBy: SortOption = levelActive && (sortBy === 'level-asc' || sortBy === 'level-desc') ? 'term-asc' : sortBy

  function handleSortChange(v: SortOption) {
    setSortBy(v)
    // Also reset if the incoming value is a level sort while level filter is active (defensive)
    if (levelActive && (v === 'level-asc' || v === 'level-desc')) setSortBy('term-asc')
  }

  const searchVisible = searchOpen || !!wordSearch

  const showingLabel = pageStart > 0 ? `${pageStart}–${pageEnd}` : '0'
  const isFiltered   = filteredCount !== topicTotalCount

  return (
    <div className="card toolbar-card">
      <div className="toolbar-search-row toolbar-search-row-desktop">
        <input className="search-input" type="text" placeholder="Search word, translation, example, notes…" value={wordSearch} onChange={(e) => setWordSearch(e.target.value)} />
      </div>

      {searchVisible && (
        <div className="toolbar-search-row toolbar-search-row-mobile">
          <input className="search-input" type="text" placeholder="Search…" value={wordSearch} onChange={(e) => setWordSearch(e.target.value)} autoFocus />
        </div>
      )}

      <div className="toolbar-controls-row">
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

        <button
          type="button"
          className={`btn btn-ghost toolbar-search-toggle ${searchVisible ? 'toolbar-search-toggle-active' : ''}`}
          aria-label="Toggle search"
          onClick={() => { if (searchOpen && wordSearch) setWordSearch(''); setSearchOpen((v) => !v) }}
        >
          {searchVisible
            ? <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/></svg>
            : <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="6.5" cy="6.5" r="4.5"/><line x1="10" y1="10" x2="14" y2="14"/></svg>
          }
        </button>
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
