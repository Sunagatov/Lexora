import type {Topic} from '../../shared/http'

export function TopicButton({topic, topicCounts, topicProgress, selectedTopicId, isSmartReview, pinnedIds, onSelect, onDelete, onPin}: {
  topic: Topic
  topicCounts: Map<number, number>
  topicProgress: Map<number, number>
  selectedTopicId: number | null
  isSmartReview: boolean
  pinnedIds: number[]
  onSelect: (id: number) => void
  onDelete: (id: number) => void
  onPin: (id: number) => void
}) {
  const progress = topicProgress.get(topic.id)
  const isPinned = pinnedIds.includes(topic.id)
  const count    = topicCounts.get(topic.id) ?? 0

  return (
    <div
      className={`topic-item ${!isSmartReview && topic.id === selectedTopicId ? 'topic-item-active' : ''}`}
      data-pinned={isPinned ? 'true' : undefined}
      title={topic.name}
    >
      <button type="button" className="topic-item-select" onClick={() => onSelect(topic.id)}>
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
