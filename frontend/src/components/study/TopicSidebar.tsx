import {useState} from 'react'
import {createPortal} from 'react-dom'
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

type TooltipState = {name: string; x: number; y: number} | null

export function TopicSidebar({topics, topicCounts, totalWords, topicSearch, setTopicSearch, selectedTopicId, onSelect}: Props) {
  const [tooltip, setTooltip] = useState<TooltipState>(null)

  function handleMouseEnter(e: React.MouseEvent, name: string) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setTooltip({name, x: r.right + 10, y: r.top + r.height / 2})
  }

  function handleTouchStart(e: React.TouchEvent, name: string) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setTooltip({name, x: r.right + 10, y: r.top + r.height / 2})
    // auto-hide after 2s on touch
    setTimeout(() => setTooltip(null), 2000)
  }

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

      <div className="sidebar-topic-list" onMouseLeave={() => setTooltip(null)}>
        {topics.length === 0 ? (
          <div className="sidebar-empty">No topics found.</div>
        ) : (
          topics.map((topic) => (
            <button
              key={topic.id}
              type="button"
              className={`topic-item ${topic.id === selectedTopicId ? 'topic-item-active' : ''}`}
              onMouseEnter={(e) => handleMouseEnter(e, topic.name)}
              onTouchStart={(e) => handleTouchStart(e, topic.name)}
              onClick={() => { setTooltip(null); onSelect(topic.id) }}
            >
              <span className="topic-item-name">{topic.name}</span>
              <span className="topic-count">{topicCounts.get(topic.id) ?? 0}</span>
            </button>
          ))
        )}
      </div>

      {tooltip && createPortal(
        <div className="topic-tooltip" style={{left: tooltip.x, top: tooltip.y}}>
          {tooltip.name}
        </div>,
        document.body,
      )}
    </>
  )
}
