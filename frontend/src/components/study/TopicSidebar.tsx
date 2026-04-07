import type {Topic} from '../../lib/api'

type Props = {
  topics: Topic[]
  topicCounts: Map<number, number>
  totalWords: number
  topicSearch: string
  setTopicSearch: (v: string) => void
  selectedTopicId: number | null
  onSelect: (id: number) => void
}

export function TopicSidebar({topics, topicCounts, totalWords, topicSearch, setTopicSearch, selectedTopicId, onSelect}: Props) {
  return (
    <>
      <div className="sidebar-brand">
        <div className="sidebar-brand-name">Lexora</div>
        <div className="sidebar-brand-sub">English vocabulary</div>
      </div>

      <div className="sidebar-stats">
        <div className="sidebar-stat">
          <span className="sidebar-stat-value">{topics.length}</span>
          <span className="sidebar-stat-label">Topics</span>
        </div>
        <div className="sidebar-stat">
          <span className="sidebar-stat-value">{totalWords}</span>
          <span className="sidebar-stat-label">Words</span>
        </div>
      </div>

      <div className="sidebar-search-wrap">
        <input
          className="sidebar-search"
          type="text"
          placeholder="Search topics…"
          value={topicSearch}
          onChange={(e) => setTopicSearch(e.target.value)}
        />
      </div>

      <div className="sidebar-topic-list">
        {topics.length === 0 ? (
          <div className="sidebar-empty">No topics found.</div>
        ) : (
          topics.map((topic) => (
            <button
              key={topic.id}
              type="button"
              className={`topic-item ${topic.id === selectedTopicId ? 'topic-item-active' : ''}`}
              data-tooltip={topic.name}
              onClick={() => onSelect(topic.id)}
            >
              <span className="topic-item-name">{topic.name}</span>
              <span className="topic-count">{topicCounts.get(topic.id) ?? 0}</span>
            </button>
          ))
        )}
      </div>
    </>
  )
}
