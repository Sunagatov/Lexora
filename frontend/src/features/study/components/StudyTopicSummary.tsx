import {ACTIVE_LEVELS, PARKED_LEVEL, LEVEL_LABELS, levelClass} from '@/features/words/model/wordDomain'
import type {WordKnowledgeLevel} from '@/features/words/types/wordTypes'

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
  return (
    <div className="sticky-controls">
      <div className="card topic-header-card topic-header-card-desktop">
        <div className="topic-header-main">
          <div className="topic-header-title-row">
            <div className="topic-header-title">{selectedTopicName ?? 'No topic selected'}</div>
            {selectedTopicId !== null && (
              <div className="topic-header-count">{filteredWordCount} of {topicWordCount} words</div>
            )}
          </div>
          <div className="topic-header-subtitle topic-header-subtitle-desktop">
            {selectedTopicId !== null
              ? (filteredWordCount === topicWordCount ? 'Reviewing the full topic.' : '')
              : 'Select a topic to start reviewing words.'}
          </div>
        </div>
        <div className="level-summary">
          {ACTIVE_LEVELS.map((level) => (
            <div key={level} className={`level-chip ${levelClass(level)}`}>
              <span className="level-chip-label">{LEVEL_LABELS[level]}</span>
              <span className="level-chip-value">{levelSummary[level]}</span>
            </div>
          ))}
          {levelSummary[PARKED_LEVEL] > 0 && (
            <div className={`level-chip ${levelClass(PARKED_LEVEL)} level-chip-parked`}>
              <span className="level-chip-label">{LEVEL_LABELS[PARKED_LEVEL]}</span>
              <span className="level-chip-value">{levelSummary[PARKED_LEVEL]}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
