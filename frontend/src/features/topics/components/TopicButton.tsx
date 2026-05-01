import type {CSSProperties} from 'react'

import type {Topic} from '@/shared/types'

export function TopicButton({topic, topicCounts, topicProgress, selectedTopicId, isSmartReview, pinnedIds, onSelect, onEdit, onDelete, onPin, level = 0, hasChildren = false, expanded = false, onToggleExpanded, staggerIdx = 0}: {
  topic: Topic
  topicCounts: Map<number, number>
  topicProgress: Map<number, number>
  selectedTopicId: number | null
  isSmartReview: boolean
  pinnedIds: number[]
  onSelect: (id: number) => void
  onEdit: (id: number) => void
  onDelete: (id: number) => void
  onPin: (id: number) => void
  level?: number
  hasChildren?: boolean
  expanded?: boolean
  onToggleExpanded?: (id: number) => void
  staggerIdx?: number
}) {
  const progress = topicProgress.get(topic.id)
  const isPinned = pinnedIds.includes(topic.id)
  const count    = topicCounts.get(topic.id) ?? 0
  const style = {
    paddingLeft: `${level * 14}px`,
    '--topic-indent': `${level * 14}px`,
    animationDelay: `${Math.min(staggerIdx, 9) * 30}ms`,
  } as CSSProperties

  return (
    <div
      className={`topic-item ${!isSmartReview && topic.id === selectedTopicId ? 'topic-item-active' : ''}`}
      data-pinned={isPinned ? 'true' : undefined}
      title={topic.name}
      style={style}
    >
      {hasChildren ? (
        <button
          type="button"
          className={`topic-item-expander ${expanded ? 'expanded' : ''}`}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${topic.name}`}
          aria-expanded={expanded}
          onClick={(e) => {
            e.stopPropagation()
            onToggleExpanded?.(topic.id)
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4,2 8,6 4,10" />
          </svg>
        </button>
      ) : (
        <span className="topic-item-expander-spacer" aria-hidden="true" />
      )}
      <button type="button" className={`topic-item-select ${hasChildren ? 'has-expander' : ''}`} onClick={() => onSelect(topic.id)}>
        <span className="topic-item-name">{topic.name}</span>
        <span className="topic-item-pct">
          {progress !== undefined ? `${progress}%` : count > 0 ? '—' : ''}
        </span>
        <span className="topic-count">{count}</span>
      </button>
      <div className="topic-item-actions">
        <button type="button" className={`topic-item-pin ${isPinned ? 'pinned' : ''}`}
          title={isPinned ? 'Unpin' : 'Pin'}
          onClick={(e) => { e.stopPropagation(); onPin(topic.id) }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill={isPinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M5 1l1 3-3 2 1 1 2-1 1 4 1-4 2 1 1-1-3-2 1-3z" />
          </svg>
        </button>
        <button type="button" className="topic-item-edit" title="Edit topic"
          onClick={(e) => { e.stopPropagation(); onEdit(topic.id) }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 8.5V10h1.5L10 3.5 8.5 2 2 8.5z" />
            <path d="M7.5 2.5l2 2" />
          </svg>
        </button>
        <span className="topic-item-actions-sep" />
        <button type="button" className="topic-item-delete" title="Delete topic"
          onClick={(e) => { e.stopPropagation(); onDelete(topic.id) }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <line x1="2" y1="2" x2="10" y2="10" /><line x1="10" y1="2" x2="2" y2="10" />
          </svg>
        </button>
      </div>
      {progress !== undefined && (
        <span className="topic-progress-bar" aria-hidden="true">
          <span className="topic-progress-fill" style={{width: `${progress}%`}} />
        </span>
      )}
    </div>
  )
}
