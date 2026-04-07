import {useEffect, useRef, useState} from 'react'

import type {WordKnowledgeLevel} from '../../lib/api'
import {LEVELS, LEVEL_LABELS, type SortOption} from '../../lib/words'

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
}

type DropdownOption<T extends string> = {
  value: T
  label: string
}

function CompactDropdown<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className = '',
}: {
  value: T
  options: DropdownOption<T>[]
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const selected = options.find((option) => option.value === value) ?? options[0]

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <div ref={rootRef} className={`dropdown ${open ? 'dropdown-open' : ''} ${className}`.trim()}>
      <button
        type="button"
        className="dropdown-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="dropdown-trigger-label">{selected.label}</span>
        <span className="dropdown-trigger-icon" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="dropdown-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((option) => {
            const isActive = option.value === value

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isActive}
                className={`dropdown-option ${isActive ? 'dropdown-option-active' : ''}`}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
              >
                <span className="dropdown-option-label">{option.label}</span>
                {isActive ? <span className="dropdown-check">✓</span> : null}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function Toolbar({
  wordSearch,
  setWordSearch,
  sortBy,
  setSortBy,
  levelFilter,
  setLevelFilter,
  onReset,
  totalWordsOverall,
  topicTotalCount,
  filteredCount,
  pageStart,
  pageEnd,
}: Props) {
  const levelActive = levelFilter !== 'all'

  useEffect(() => {
    if (levelActive && (sortBy === 'level-asc' || sortBy === 'level-desc')) {
      setSortBy('term-asc')
    }
  }, [levelActive, sortBy, setSortBy])

  const sortOptions: DropdownOption<SortOption>[] = levelActive
    ? [
        {value: 'term-asc', label: 'A → Z'},
        {value: 'term-desc', label: 'Z → A'},
      ]
    : [
        {value: 'level-asc', label: 'Level ↑'},
        {value: 'level-desc', label: 'Level ↓'},
        {value: 'term-asc', label: 'A → Z'},
        {value: 'term-desc', label: 'Z → A'},
      ]

  const levelOptions: DropdownOption<'all' | `${WordKnowledgeLevel}`>[] = [
    {value: 'all', label: 'All levels'},
    ...LEVELS.map((level) => ({
      value: String(level) as `${WordKnowledgeLevel}`,
      label: `Level ${level} — ${LEVEL_LABELS[level]}`,
    })),
  ]

  const hasVisibleRows = pageStart > 0 && pageEnd > 0
  const showingLabel = hasVisibleRows ? `${pageStart}–${pageEnd}` : '0'
  const isFiltered = filteredCount !== topicTotalCount

  return (
    <div className="card toolbar-card">
      <div className="toolbar-search-row">
        <input
          className="search-input"
          type="text"
          placeholder="Search word, translation, example, notes…"
          value={wordSearch}
          onChange={(e) => setWordSearch(e.target.value)}
        />
      </div>

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
          onChange={(value) => {
            setLevelFilter(value === 'all' ? 'all' : (Number(value) as WordKnowledgeLevel))
          }}
          ariaLabel="Filter words by level"
          className="toolbar-control toolbar-control-level"
        />

        <button type="button" className="btn btn-ghost toolbar-reset-btn" onClick={onReset}>
          Reset
        </button>
      </div>

      <div className="toolbar-meta-row">
        <div className="results-meta">
          <span className="results-meta-item results-meta-item-showing">
            Showing <strong>{showingLabel}</strong>
          </span>

          {isFiltered ? (
            <>
              <span className="results-meta-separator results-meta-separator-filtered">·</span>
              <span className="results-meta-item results-meta-item-filtered">
                <strong>{filteredCount}</strong> filtered
              </span>
            </>
          ) : null}

          <span className="results-meta-separator results-meta-separator-topic">·</span>
          <span className="results-meta-item results-meta-item-topic">
            <strong>{topicTotalCount}</strong> in topic
          </span>

          <span className="results-meta-separator results-meta-separator-total">·</span>
          <span className="results-meta-item results-meta-item-total">
            <strong>{totalWordsOverall}</strong> total
          </span>
        </div>
      </div>
    </div>
  )
}