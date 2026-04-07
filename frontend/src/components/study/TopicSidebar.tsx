import {useState} from 'react'
import {createPortal} from 'react-dom'
import type {Topic} from '../../lib/api'

type Props = {
  topics: Topic[]
  topicCounts: Map<number, number>
  topicPos: Map<number, string>
  totalWords: number
  topicSearch: string
  setTopicSearch: (v: string) => void
  selectedTopicId: number | null
  onSelect: (id: number) => void
}

type TooltipState = {name: string; x: number; y: number; anchor: 'left' | 'right'} | null

const POS_ORDER = ['verb', 'noun', 'adjective', 'adverb', 'phrase', 'preposition', 'other']

const POS_LABELS: Record<string, string> = {
  verb: 'Verbs', noun: 'Nouns', adjective: 'Adjectives',
  adverb: 'Adverbs', phrase: 'Phrases', preposition: 'Prepositions', other: 'Other',
}

export function TopicSidebar({topics, topicCounts, topicPos, totalWords, topicSearch, setTopicSearch, selectedTopicId, onSelect}: Props) {
  const [tooltip, setTooltip] = useState<TooltipState>(null)

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

  // Group topics by POS, preserving POS_ORDER
  const grouped = new Map<string, Topic[]>()
  for (const topic of topics) {
    const pos = topicPos.get(topic.id) ?? 'other'
    if (!grouped.has(pos)) grouped.set(pos, [])
    grouped.get(pos)!.push(topic)
  }
  const groups = POS_ORDER.filter((pos) => grouped.has(pos))
  const showGroups = !topicSearch.trim() && groups.length > 1

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
        ) : showGroups ? (
          groups.map((pos) => (
            <div key={pos} className="sidebar-group">
              <div className="sidebar-group-label">{POS_LABELS[pos] ?? pos}</div>
              {grouped.get(pos)!.map((topic) => (
                <TopicButton
                  key={topic.id}
                  topic={topic}
                  count={topicCounts.get(topic.id) ?? 0}
                  isActive={topic.id === selectedTopicId}
                  onMouseEnter={handleMouseEnter}
                  onTouchStart={handleTouchStart}
                  onSelect={onSelect}
                  clearTooltip={() => setTooltip(null)}
                />
              ))}
            </div>
          ))
        ) : (
          topics.map((topic) => (
            <TopicButton
              key={topic.id}
              topic={topic}
              count={topicCounts.get(topic.id) ?? 0}
              isActive={topic.id === selectedTopicId}
              onMouseEnter={handleMouseEnter}
              onTouchStart={handleTouchStart}
              onSelect={onSelect}
              clearTooltip={() => setTooltip(null)}
            />
          ))
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

function TopicButton({topic, count, isActive, onMouseEnter, onTouchStart, onSelect, clearTooltip}: {
  topic: Topic
  count: number
  isActive: boolean
  onMouseEnter: (e: React.MouseEvent, name: string) => void
  onTouchStart: (e: React.TouchEvent, name: string) => void
  onSelect: (id: number) => void
  clearTooltip: () => void
}) {
  return (
    <button
      type="button"
      className={`topic-item ${isActive ? 'topic-item-active' : ''}`}
      onMouseEnter={(e) => onMouseEnter(e, topic.name)}
      onTouchStart={(e) => onTouchStart(e, topic.name)}
      onClick={() => { clearTooltip(); onSelect(topic.id) }}
    >
      <span className="topic-item-name">{topic.name}</span>
      <span className="topic-count">{count}</span>
    </button>
  )
}
