import {useState} from 'react'
import {createPortal} from 'react-dom'
import type {StudyQueue, Topic} from '../../lib/api'

type Props = {
  topics: Topic[]
  topicCounts: Map<number, number>
  totalWords: number
  topicSearch: string
  setTopicSearch: (v: string) => void
  selectedTopicId: number | null
  isSmartReview: boolean
  onSelect: (id: number) => void
  onSelectSmartReview: () => void
  smartQueue: StudyQueue | null
}

type TooltipState = {name: string; x: number; y: number; anchor: 'left' | 'right'} | null

const POS_NAMES = new Set([
  'adjectives', 'adverbs', 'nouns', 'verbs', 'phrases',
  'prepositions', 'irregular verbs',
])

function isPosGroup(topic: Topic): boolean {
  return POS_NAMES.has(topic.name.toLowerCase().trim())
}

function loadCollapsed(key: string, def: boolean): boolean {
  try { return JSON.parse(localStorage.getItem(key) ?? String(def)) } catch { return def }
}

function saveCollapsed(key: string, val: boolean) {
  localStorage.setItem(key, JSON.stringify(val))
}

export function TopicSidebar({
  topics, topicCounts, totalWords, topicSearch, setTopicSearch,
  selectedTopicId, isSmartReview, onSelect, onSelectSmartReview, smartQueue,
}: Props) {
  const [tooltip, setTooltip] = useState<TooltipState>(null)
  const [posCollapsed,    setPosCollapsed]    = useState(() => loadCollapsed('sidebar_pos_collapsed', false))
  const [topicsCollapsed, setTopicsCollapsed] = useState(() => loadCollapsed('sidebar_topics_collapsed', false))

  function togglePos() {
    const next = !posCollapsed
    setPosCollapsed(next)
    saveCollapsed('sidebar_pos_collapsed', next)
  }

  function toggleTopics() {
    const next = !topicsCollapsed
    setTopicsCollapsed(next)
    saveCollapsed('sidebar_topics_collapsed', next)
  }

  function handleMouseEnter(e: React.MouseEvent, name: string) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setTooltip({name, x: r.right + 10, y: r.top + r.height / 2, anchor: 'left'})
  }

  function handleTouchStart(e: React.TouchEvent, name: string) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const spaceRight = window.innerWidth - r.right
    if (spaceRight > 150) {
      setTooltip({name, x: r.right + 10, y: r.top + r.height / 2, anchor: 'left'})
    } else {
      setTooltip({name, x: window.innerWidth - r.left + 10, y: r.top + r.height / 2, anchor: 'right'})
    }
    setTimeout(() => setTooltip(null), 2000)
  }

  const needle = topicSearch.toLowerCase().trim()

  const posTopics    = topics.filter((t) => isPosGroup(t) && (!needle || t.name.toLowerCase().includes(needle)))
  const themeTopics  = topics.filter((t) => !isPosGroup(t) && (!needle || t.name.toLowerCase().includes(needle) || (t.description ?? '').toLowerCase().includes(needle)))

  const remaining = smartQueue ? smartQueue.total_count - smartQueue.completed_count : null
  const progress  = smartQueue && smartQueue.total_count > 0
    ? Math.round((smartQueue.completed_count / smartQueue.total_count) * 100)
    : 0

  const topicButtonProps = {
    selectedTopicId,
    isSmartReview,
    topicCounts,
    onMouseEnter: handleMouseEnter,
    onTouchStart: handleTouchStart,
    onSelect,
    clearTooltip: () => setTooltip(null),
  }

  return (
    <>
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

      <div className="sidebar-smart-review-wrap">
        <button
          type="button"
          className={`sidebar-smart-review-btn ${isSmartReview ? 'active' : ''}`}
          onClick={onSelectSmartReview}
        >
          <div className="sidebar-smart-review-top">
            <span className="sidebar-smart-review-title">⚡ Smart Review</span>
            {remaining !== null && (
              <span className="sidebar-smart-review-count">{remaining} left</span>
            )}
          </div>
          {smartQueue && (
            <div className="sidebar-smart-review-bar">
              <div className="sidebar-smart-review-fill" style={{width: `${progress}%`}} />
            </div>
          )}
        </button>
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

        {posTopics.length > 0 && (
          <div className="sidebar-group">
            <button type="button" className="sidebar-group-toggle" onClick={togglePos}>
              <svg
                className={`sidebar-group-chevron ${posCollapsed ? 'collapsed' : ''}`}
                width="12" height="12" viewBox="0 0 12 12" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              >
                <polyline points="2,4 6,8 10,4" />
              </svg>
              <span>Parts of Speech</span>
              <span className="sidebar-group-count">{posTopics.length}</span>
            </button>
            {!posCollapsed && posTopics.map((topic) => (
              <TopicButton key={topic.id} topic={topic} {...topicButtonProps} />
            ))}
          </div>
        )}

        {themeTopics.length > 0 && (
          <div className="sidebar-group">
            <button type="button" className="sidebar-group-toggle" onClick={toggleTopics}>
              <svg
                className={`sidebar-group-chevron ${topicsCollapsed ? 'collapsed' : ''}`}
                width="12" height="12" viewBox="0 0 12 12" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              >
                <polyline points="2,4 6,8 10,4" />
              </svg>
              <span>Topics</span>
              <span className="sidebar-group-count">{themeTopics.length}</span>
            </button>
            {!topicsCollapsed && themeTopics.map((topic) => (
              <TopicButton key={topic.id} topic={topic} {...topicButtonProps} />
            ))}
          </div>
        )}

        {posTopics.length === 0 && themeTopics.length === 0 && (
          <div className="sidebar-empty">No topics found.</div>
        )}
      </div>

      {tooltip && createPortal(
        <div
          className="topic-tooltip"
          style={tooltip.anchor === 'left'
            ? {left: tooltip.x, top: tooltip.y}
            : {right: tooltip.x, top: tooltip.y}
          }
        >
          {tooltip.name}
        </div>,
        document.body,
      )}
    </>
  )
}

function TopicButton({topic, topicCounts, selectedTopicId, isSmartReview, onMouseEnter, onTouchStart, onSelect, clearTooltip}: {
  topic: Topic
  topicCounts: Map<number, number>
  selectedTopicId: number | null
  isSmartReview: boolean
  onMouseEnter: (e: React.MouseEvent, name: string) => void
  onTouchStart: (e: React.TouchEvent, name: string) => void
  onSelect: (id: number) => void
  clearTooltip: () => void
}) {
  return (
    <button
      type="button"
      className={`topic-item ${!isSmartReview && topic.id === selectedTopicId ? 'topic-item-active' : ''}`}
      onMouseEnter={(e) => onMouseEnter(e, topic.name)}
      onTouchStart={(e) => onTouchStart(e, topic.name)}
      onClick={() => { clearTooltip(); onSelect(topic.id) }}
    >
      <span className="topic-item-name">{topic.name}</span>
      <span className="topic-count">{topicCounts.get(topic.id) ?? 0}</span>
    </button>
  )
}
