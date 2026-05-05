import {useState} from 'react'
import {ACTIVE_LEVELS, LEVEL_LABELS} from '@/features/words/model/wordDomain'
import type {WordKnowledgeLevel} from '@/features/words/types/wordTypes'

const BAR_COLORS: Record<number, string> = {1: '#dc2626', 2: '#2563eb', 3: '#7c3aed', 4: '#059669', 5: '#64748b'}

type Props = {
  selectedTopicId: number | null
  selectedTopicName?: string
  filteredWordCount: number
  topicWordCount: number
  levelSummary: Record<WordKnowledgeLevel, number>
}

export function StudyTopicSummary({
  selectedTopicId,
  selectedTopicName,
  filteredWordCount,
  topicWordCount,
  levelSummary,
}: Props) {
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false)
  const total = topicWordCount || 1
  const masteredPct = Math.round((levelSummary[4] / total) * 100)
  const isFiltered = filteredWordCount !== topicWordCount

  return (
    <div className="sticky-controls">
      <div className="card topic-header-card">
        <div className="topic-header-left">
          <div className="topic-header-title">{selectedTopicName ?? 'No topic selected'}</div>
          {selectedTopicId !== null && (
            <div className="topic-header-meta">
              <span>{isFiltered ? `${filteredWordCount} of ${topicWordCount} words` : `${topicWordCount} words`}</span>
              <span className="topic-header-mastered">{masteredPct}% mastered</span>
              <button
                type="button"
                className="topic-header-toggle-btn ripple-btn"
                onClick={() => setIsBreakdownOpen((open) => !open)}
                aria-expanded={isBreakdownOpen}
                aria-label="Toggle topic progress breakdown"
              >
                <span className={`topic-header-toggle-chevron${isBreakdownOpen ? ' is-open' : ''}`}>▶</span>
                <span className="topic-header-toggle-label">{isBreakdownOpen ? 'Hide breakdown' : 'Show breakdown'}</span>
              </button>
            </div>
          )}
        </div>
        {selectedTopicId !== null && isBreakdownOpen && (
          <div className="topic-header-right">
            <div className="topic-header-bar">
              {ACTIVE_LEVELS.map((l) => {
                const pct = (levelSummary[l] / total) * 100
                if (pct === 0) return null
                return <div key={l} className="topic-header-bar-seg" style={{width: `${pct}%`, background: BAR_COLORS[l]}} />
              })}
            </div>
            <div className="topic-header-legend">
              {ACTIVE_LEVELS.map((l) => {
                if (!levelSummary[l]) return null
                return (
                  <span key={l} className="topic-header-legend-item">
                    <span className="topic-header-legend-dot" style={{background: BAR_COLORS[l]}} />
                    {levelSummary[l]} {LEVEL_LABELS[l]}
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
