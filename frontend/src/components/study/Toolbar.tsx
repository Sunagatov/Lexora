import {useEffect, useState} from 'react'

import type {WordKnowledgeLevel} from '../../lib/api'
import {LEVELS, LEVEL_LABELS, type SortOption} from '../../lib/words'
import {CompactDropdown} from './CompactDropdown'

type Props = {
  wordSearch: string
  setWordSearch: (v: string) => void
  sortBy: SortOption
  setSortBy: (v: SortOption) => void
  levelFilter: 'all' | WordKnowledgeLevel
  setLevelFilter: (v: 'all' | WordKnowledgeLevel) => void
  onReset: () => void
  totalWordsOverall: number
  topicTotalCount: number
  filteredCount: number
  pageStart: number
  pageEnd: number
  levelSummary: Record<WordKnowledgeLevel, number>
}

export function Toolbar({
  wordSearch, setWordSearch,
  sortBy, setSortBy,
  levelFilter, setLevelFilter,
  onReset,
  totalWordsOverall, topicTotalCount, filteredCount,
  pageStart, pageEnd,
  levelSummary,
}: Props) {
  const levelActive = levelFilter !== 'all'

  useEffect(() => {
    if (levelActive && (sortBy === 'level-asc' || sortBy === 'level-desc')) {
      setSortBy('term-asc')
    }
  }, [levelActive, sortBy, setSortBy])

  const sortOptions = levelActive
    ? [
        {value: 'term-asc' as SortOption, label: 'A → Z'},
        {value: 'term-desc' as SortOption, label: 'Z → A'},
      ]
    : [
        {value: 'level-asc' as SortOption, label: 'Level ↑'},
        {value: 'level-desc' as SortOption, label: 'Level ↓'},
        {value: 'term-asc' as SortOption, label: 'A → Z'},
        {value: 'term-desc' as SortOption, label: 'Z → A'},
      ]

  const levelOptions = [
    {value: 'all' as const, label: `All levels — ${topicTotalCount}`},
    ...LEVELS.map((l) => ({
      value: String(l) as `${WordKnowledgeLevel}`,
      label: `${l} ${LEVEL_LABELS[l]} — ${levelSummary[l]}`,
    })),
  ]

  const [searchOpen, setSearchOpen] = useState(false)
  const searchVisible = searchOpen || !!wordSearch

  const hasRows = pageStart > 0 && pageEnd > 0
  const showingLabel = hasRows ? `${pageStart}–${pageEnd}` : '0'
  const isFiltered = filteredCount !== topicTotalCount

  return (
    <div className="card toolbar-card">
      {searchVisible && (
        <div className="toolbar-search-row">
          <input
            className="search-input"
            type="text"
            placeholder="Search word, translation, example, notes…"
            value={wordSearch}
            onChange={(e) => setWordSearch(e.target.value)}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
        </div>
      )}

      <div className="toolbar-controls-row">
        <CompactDropdown
          value={sortBy}
          options={sortOptions}
          onChange={setSortBy}
          ariaLabel="Sort words"
          className="toolbar-control toolbar-control-sort"
        />

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
          onClick={() => {
            if (searchOpen && wordSearch) setWordSearch('')
            setSearchOpen((v) => !v)
          }}
        >
          {searchVisible ? '✕' : '🔍'}
        </button>

        <button type="button" className="btn btn-ghost toolbar-reset-btn" onClick={onReset}>
          Reset
        </button>
      </div>

      <div className="toolbar-meta-row">
        <div className="results-meta">
          <span className="results-meta-item">Showing <strong>{showingLabel}</strong></span>

          {isFiltered && (
            <>
              <span className="results-meta-separator">·</span>
              <span className="results-meta-item"><strong>{filteredCount}</strong> filtered</span>
            </>
          )}

          <span className="results-meta-separator">·</span>
          <span className="results-meta-item"><strong>{topicTotalCount}</strong> in topic</span>

          <span className="results-meta-separator results-meta-separator-total">·</span>
          <span className="results-meta-item results-meta-item-total"><strong>{totalWordsOverall}</strong> total</span>
        </div>
      </div>
    </div>
  )
}
