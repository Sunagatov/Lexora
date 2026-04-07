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
  filteredCount: number
  totalCount: number
}

export function Toolbar({wordSearch, setWordSearch, sortBy, setSortBy, levelFilter, setLevelFilter, onReset, filteredCount, totalCount}: Props) {
  const levelActive = levelFilter !== 'all'

  return (
    <div className="card toolbar-card">
      <input
        className="search-input"
        type="text"
        placeholder="Search word, translation, example, notes…"
        value={wordSearch}
        onChange={(e) => setWordSearch(e.target.value)}
      />

      <div className="toolbar-row">
        {!levelActive && (
          <select className="field-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)}>
            <option value="level-asc">Level ↑</option>
            <option value="level-desc">Level ↓</option>
            <option value="term-asc">A → Z</option>
            <option value="term-desc">Z → A</option>
          </select>
        )}

        <select
          className="field-select"
          value={String(levelFilter)}
          onChange={(e) => {
            const v = e.target.value
            setLevelFilter(v === 'all' ? 'all' : (Number(v) as WordKnowledgeLevel))
          }}
        >
          <option value="all">All levels</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>Level {l} — {LEVEL_LABELS[l]}</option>
          ))}
        </select>

        <button type="button" className="btn btn-ghost" onClick={onReset}>Reset</button>

        <span className="results-meta">
          <strong>{filteredCount}</strong> / <strong>{totalCount}</strong> words
        </span>
      </div>
    </div>
  )
}
