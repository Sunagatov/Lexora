import {useEffect, useState} from 'react'
import type {WordKnowledgeLevel} from '../../shared/http'
import {LEVELS, LEVEL_LABELS, type SortOption} from '../../shared/wordDomain'
import {CompactDropdown} from '../../shared/CompactDropdown'

type Props = {
  wordSearch: string; setWordSearch: (v: string) => void
  sortBy: SortOption; setSortBy: (v: SortOption) => void
  levelFilter: 'all' | WordKnowledgeLevel; setLevelFilter: (v: 'all' | WordKnowledgeLevel) => void
  onReset: () => void
  totalWordsOverall: number; topicTotalCount: number; filteredCount: number
  pageStart: number; pageEnd: number
  levelSummary: Record<WordKnowledgeLevel, number>
}

export function Toolbar({
  wordSearch, setWordSearch, sortBy, setSortBy, levelFilter, setLevelFilter,
  onReset, totalWordsOverall, topicTotalCount, filteredCount, pageStart, pageEnd, levelSummary,
}: Props) {
  const [searchOpen, setSearchOpen] = useState(false)
  const levelActive    = levelFilter !== 'all'
  const searchVisible  = searchOpen || !!wordSearch

  useEffect(() => {
    if (levelActive && (sortBy === 'level-asc' || sortBy === 'level-desc')) setSortBy('term-asc')
  }, [levelActive, sortBy, setSortBy])

  const sortOptions = levelActive
    ? [{value: 'term-asc' as SortOption, label: 'A → Z'}, {value: 'term-desc' as SortOption, label: 'Z → A'}]
    : [
        {value: 'level-asc' as SortOption, label: 'Level ↑'}, {value: 'level-desc' as SortOption, label: 'Level ↓'},
        {value: 'term-asc' as SortOption, label: 'A → Z'},    {value: 'term-desc' as SortOption, label: 'Z → A'},
      ]

  const levelOptions = [
    {value: 'all' as const, label: `All levels — ${topicTotalCount}`},
    ...LEVELS.map((l) => ({value: String(l) as `${WordKnowledgeLevel}`, label: `${l} ${LEVEL_LABELS[l]} — ${levelSummary[l]}`})),
  ]

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
        <CompactDropdown value={sortBy} options={sortOptions} onChange={setSortBy} ariaLabel="Sort words" className="toolbar-control toolbar-control-sort" />
        <CompactDropdown
          value={String(levelFilter) as 'all' | `${WordKnowledgeLevel}`}
          options={levelOptions}
          onChange={(v) => setLevelFilter(v === 'all' ? 'all' : (Number(v) as WordKnowledgeLevel))}
          ariaLabel="Filter words by level"
          className="toolbar-control toolbar-control-level"
        />
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
          <span className="results-meta-item"><strong>{topicTotalCount}</strong> in topic</span>
          <span className="results-meta-separator results-meta-separator-total">·</span>
          <span className="results-meta-item results-meta-item-total"><strong>{totalWordsOverall}</strong> total</span>
        </div>
      </div>
    </div>
  )
}
