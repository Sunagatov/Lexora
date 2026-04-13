import {useRef, useMemo, useState} from 'react'
import {createPortal} from 'react-dom'
import {useNavigate} from 'react-router-dom'
import {useMutation, useQueryClient} from '@tanstack/react-query'
import {deleteTopic, createTopic} from './api'
import type {StudyQueue, Topic} from '../../shared/http'
import {ConfirmModal} from '../../shared/ConfirmModal'
import {slugify} from '../../shared/slugify'

type Props = {
  topics: Topic[]
  topicCounts: Map<number, number>
  topicProgress: Map<number, number>
  totalWords: number
  topicSearch: string
  setTopicSearch: (v: string) => void
  selectedTopicId: number | null
  isSmartReview: boolean
  isMobile?: boolean
  onSelect: (id: number) => void
  onSelectSmartReview: () => void
  smartQueue: StudyQueue | null
}

type SortMode = 'default' | 'weakest' | 'strongest' | 'largest' | 'az' | 'za'

const SORT_LABELS: Record<SortMode, string> = {
  default: 'Default', weakest: 'Weakest first', strongest: 'Strongest first',
  largest: 'Largest first', az: 'A → Z', za: 'Z → A',
}

const POS_NAMES = new Set(['adjectives', 'adverbs', 'nouns', 'verbs', 'phrases', 'prepositions', 'irregular verbs'])

function isPosGroup(topic: Topic) {
  return POS_NAMES.has(topic.name.toLowerCase().trim())
}

function loadPref<T>(key: string, def: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? def } catch { return def }
}
function savePref(key: string, val: unknown) {
  localStorage.setItem(key, JSON.stringify(val))
}

function sortTopics(topics: Topic[], mode: SortMode, progress: Map<number, number>, counts: Map<number, number>): Topic[] {
  const t = [...topics]
  switch (mode) {
    case 'weakest':   return t.sort((a, b) => (progress.get(a.id) ?? 0) - (progress.get(b.id) ?? 0))
    case 'strongest': return t.sort((a, b) => (progress.get(b.id) ?? 0) - (progress.get(a.id) ?? 0))
    case 'largest':   return t.sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
    case 'az':        return t.sort((a, b) => a.name.localeCompare(b.name))
    case 'za':        return t.sort((a, b) => b.name.localeCompare(a.name))
    default:          return t
  }
}

const SORT_OPTIONS: {value: SortMode; label: string}[] = [
  {value: 'default',   label: 'Default'},
  {value: 'weakest',   label: 'Weakest first'},
  {value: 'strongest', label: 'Strongest first'},
  {value: 'largest',   label: 'Largest first'},
  {value: 'az',        label: 'A → Z'},
  {value: 'za',        label: 'Z → A'},
]

export function TopicSidebar({
  topics, topicCounts, topicProgress, totalWords, topicSearch, setTopicSearch,
  selectedTopicId, isSmartReview, isMobile = false, onSelect, onSelectSmartReview, smartQueue,
}: Props) {
  const [posCollapsed,    setPosCollapsed]    = useState(() => loadPref('sidebar_pos_collapsed', false))
  const [topicsCollapsed, setTopicsCollapsed] = useState(() => loadPref('sidebar_topics_collapsed', false))
  const [posSort,         setPosSort]         = useState<SortMode>(() => loadPref('sidebar_pos_sort', 'default'))
  const [topicsSort,      setTopicsSort]      = useState<SortMode>(() => loadPref('sidebar_topics_sort', 'default'))
  const [posSortOpen,     setPosSortOpen]     = useState(false)
  const [topicsSortOpen,  setTopicsSortOpen]  = useState(false)
  const [searchOpen,      setSearchOpen]      = useState(false)
  const [pinnedIds,       setPinnedIds]       = useState<number[]>(() => loadPref('sidebar_pinned', []))
  const [deleteTopicId,   setDeleteTopicId]   = useState<number | null>(null)
  const [newTopicName,    setNewTopicName]     = useState('')
  const [addingTopic,     setAddingTopic]      = useState(false)
  const [topicError,      setTopicError]       = useState<string | null>(null)
  const searchRef     = useRef<HTMLInputElement>(null)
  const posSortRef    = useRef<HTMLButtonElement>(null)
  const topicsSortRef = useRef<HTMLButtonElement>(null)
  const navigate    = useNavigate()
  const queryClient = useQueryClient()

  const createTopicMutation = useMutation({
    mutationFn: () => createTopic(newTopicName.trim(), slugify(newTopicName.trim())),
    onSuccess: (created) => {
      queryClient.invalidateQueries({queryKey: ['topics']})
      setNewTopicName(''); setAddingTopic(false); setTopicError(null)
      onSelect(created.id)
    },
    onError: () => setTopicError('Name already exists or is invalid.'),
  })

  const deleteTopicMutation = useMutation({
    mutationFn: (id: number) => deleteTopic(id, true),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['topics']})
      queryClient.invalidateQueries({queryKey: ['words']})
      setDeleteTopicId(null)
    },
  })

  function togglePos() {
    const next = !posCollapsed; setPosCollapsed(next); savePref('sidebar_pos_collapsed', next)
  }
  function toggleTopics() {
    const next = !topicsCollapsed; setTopicsCollapsed(next); savePref('sidebar_topics_collapsed', next)
  }
  function applyPosSort(mode: SortMode) {
    setPosSort(mode); savePref('sidebar_pos_sort', mode); setPosSortOpen(false)
  }
  function applyTopicsSort(mode: SortMode) {
    setTopicsSort(mode); savePref('sidebar_topics_sort', mode); setTopicsSortOpen(false)
  }
  function openSearch() {
    setSearchOpen(true)
    setTimeout(() => searchRef.current?.focus(), 60)
  }
  function closeSearch() {
    setSearchOpen(false)
    setTopicSearch('')
  }
  function togglePin(id: number) {
    const next = pinnedIds.includes(id)
      ? pinnedIds.filter((x) => x !== id)
      : [id, ...pinnedIds].slice(0, 5)
    setPinnedIds(next)
    savePref('sidebar_pinned', next)
  }

  const needle = topicSearch.toLowerCase().trim()

  // Compute main section lists — exclude pinned topics to prevent duplication
  const pinnedIdSet = useMemo(() => new Set(pinnedIds), [pinnedIds])

  const posTopics   = sortTopics(
    topics.filter((t) => isPosGroup(t) && !pinnedIdSet.has(t.id) && (!needle || t.name.toLowerCase().includes(needle))),
    posSort, topicProgress, topicCounts,
  )
  const themeTopics = sortTopics(
    topics.filter((t) => !isPosGroup(t) && !pinnedIdSet.has(t.id) && (!needle || t.name.toLowerCase().includes(needle) || (t.description ?? '').toLowerCase().includes(needle))),
    topicsSort, topicProgress, topicCounts,
  )

  // Pinned topics — always show regardless of search
  const pinnedTopics = useMemo(() =>
    pinnedIds.map((id) => topics.find((t) => t.id === id)).filter((t): t is Topic => !!t),
    [pinnedIds, topics],
  )

  // Recent topics (exclude pinned, exclude already-visible in expanded sections, max 4)
  const recentTopicIds: number[] = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('sidebar_recent_topics') ?? '[]') } catch { return [] }
  }, [topics])

  const recentTopics = useMemo(() => {
    const expandedIds = new Set<number>()
    if (!posCollapsed) posTopics.forEach((t) => expandedIds.add(t.id))
    if (!topicsCollapsed) themeTopics.forEach((t) => expandedIds.add(t.id))
    return recentTopicIds
      .map((id) => topics.find((t) => t.id === id))
      .filter((t): t is Topic =>
        !!t && !needle && !pinnedIds.includes(t.id) && !expandedIds.has(t.id)
      )
      .slice(0, 4)
  }, [recentTopicIds, topics, needle, pinnedIds, posCollapsed, topicsCollapsed, posTopics, themeTopics])

  const remaining  = smartQueue ? smartQueue.total_count - smartQueue.completed_count : null
  const srProgress = smartQueue && smartQueue.total_count > 0
    ? Math.round((smartQueue.completed_count / smartQueue.total_count) * 100) : 0

  // Section summary helpers
  function weakCount(list: Topic[]) {
    return list.filter((t) => (topicProgress.get(t.id) ?? 0) < 30 && (topicCounts.get(t.id) ?? 0) > 0).length
  }

  const btnProps = {
    selectedTopicId, isSmartReview, topicCounts, topicProgress,
    pinnedIds, onSelect, onDelete: (id: number) => setDeleteTopicId(id), onPin: togglePin,
  }

  return (
    <>
      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <div className="sidebar-counts">
        <span>{topics.length} topics</span>
        <span className="sidebar-counts-sep">·</span>
        <span>{totalWords.toLocaleString()} words</span>
      </div>

      {/* ── Smart Review ───────────────────────────────────────────────── */}
      <div className="sidebar-smart-review-wrap">
        <button
          type="button"
          className={`sidebar-smart-review-btn ${isSmartReview ? 'active' : ''}`}
          onClick={onSelectSmartReview}
        >
          <span className="sidebar-smart-review-title">✨ Daily Word Mix <span className="sidebar-smart-review-ai">made by AI</span></span>
          {remaining !== null && <span className="sidebar-smart-review-count">{remaining} left</span>}
          {smartQueue && (
            <div className="sidebar-smart-review-bar">
              <div className="sidebar-smart-review-fill" style={{width: `${srProgress}%`}} />
            </div>
          )}
        </button>
      </div>

      {/* ── Search ─────────────────────────────────────────────────────── */}
      <div className="sidebar-search-wrap">
        {isMobile ? (
          searchOpen ? (
            <div className="sidebar-search-mobile-row">
              <input
                ref={searchRef}
                className="sidebar-search"
                type="text"
                placeholder="Search topics…"
                value={topicSearch}
                onChange={(e) => setTopicSearch(e.target.value)}
              />
              <button type="button" className="sidebar-search-close" onClick={closeSearch} aria-label="Close search">
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="1" y1="1" x2="13" y2="13"/><line x1="13" y1="1" x2="1" y2="13"/>
                </svg>
              </button>
            </div>
          ) : (
            <button type="button" className="sidebar-search-toggle" onClick={openSearch} aria-label="Search topics">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="6.5" cy="6.5" r="4.5" />
                <line x1="10" y1="10" x2="14" y2="14" />
              </svg>
              <span>Search</span>
            </button>
          )
        ) : (
          <input
            className="sidebar-search"
            type="text"
            placeholder="Search topics…"
            value={topicSearch}
            onChange={(e) => setTopicSearch(e.target.value)}
          />
        )}
      </div>

      {/* ── Topic list ─────────────────────────────────────────────────── */}
      <div className="sidebar-topic-list">

        {/* Pinned */}
        {pinnedTopics.length > 0 && (
          <div className="sidebar-group">
            <div className="sidebar-group-header">
              <span className="sidebar-group-label">📌 Pinned</span>
            </div>
            {pinnedTopics.map((t) => <TopicButton key={t.id} topic={t} {...btnProps} />)}
          </div>
        )}

        {/* Recent */}
        {recentTopics.length > 0 && (
          <div className="sidebar-group">
            <div className="sidebar-group-header">
              <span className="sidebar-group-label">🕒 Recent</span>
            </div>
            {recentTopics.map((t) => <TopicButton key={t.id} topic={t} {...btnProps} />)}
          </div>
        )}

        {/* Parts of Speech */}
        {posTopics.length > 0 && (
          <div className="sidebar-group">
            <div className="sidebar-group-header">
              <button type="button" className="sidebar-group-toggle" onClick={togglePos}>
                <svg className={`sidebar-group-chevron ${posCollapsed ? 'collapsed' : ''}`} width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="2,4 6,8 10,4" />
                </svg>
                <span>Parts of Speech</span>
                <span className="sidebar-group-count">{posTopics.length}</span>
              </button>
              <div className="sidebar-sort-wrap">
                <button ref={posSortRef} type="button" className={`sidebar-sort-btn ${posSort !== 'default' ? 'active' : ''}`} onClick={() => setPosSortOpen((v) => !v)} aria-label="Sort">
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <line x1="2" y1="4" x2="12" y2="4"/><line x1="4" y1="7" x2="10" y2="7"/><line x1="6" y1="10" x2="8" y2="10"/>
                  </svg>
                </button>
                {posSortOpen && <SortMenu options={SORT_OPTIONS} current={posSort} anchorRef={posSortRef} onSelect={applyPosSort} onClose={() => setPosSortOpen(false)} />}
              </div>
            </div>
            {posSort !== 'default' && (
              <div className="sidebar-group-meta">
                {SORT_LABELS[posSort]}
                {weakCount(posTopics) > 0 && <> · <span className="sidebar-group-meta-weak">{weakCount(posTopics)} weak</span></>}
              </div>
            )}
            {!posCollapsed && posTopics.map((t) => <TopicButton key={t.id} topic={t} {...btnProps} />)}
          </div>
        )}

        {/* Topics */}
        {themeTopics.length > 0 && (
          <div className="sidebar-group">
            <div className="sidebar-group-header">
              <button type="button" className="sidebar-group-toggle" onClick={toggleTopics}>
                <svg className={`sidebar-group-chevron ${topicsCollapsed ? 'collapsed' : ''}`} width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="2,4 6,8 10,4" />
                </svg>
                <span>Topics</span>
                <span className="sidebar-group-count">{themeTopics.length}</span>
              </button>
              <div className="sidebar-sort-wrap">
                <button ref={topicsSortRef} type="button" className={`sidebar-sort-btn ${topicsSort !== 'default' ? 'active' : ''}`} onClick={() => setTopicsSortOpen((v) => !v)} aria-label="Sort">
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <line x1="2" y1="4" x2="12" y2="4"/><line x1="4" y1="7" x2="10" y2="7"/><line x1="6" y1="10" x2="8" y2="10"/>
                  </svg>
                </button>
                {topicsSortOpen && <SortMenu options={SORT_OPTIONS} current={topicsSort} anchorRef={topicsSortRef} onSelect={applyTopicsSort} onClose={() => setTopicsSortOpen(false)} />}
              </div>
            </div>
            {topicsSort !== 'default' && (
              <div className="sidebar-group-meta">
                {SORT_LABELS[topicsSort]}
                {weakCount(themeTopics) > 0 && <> · <span className="sidebar-group-meta-weak">{weakCount(themeTopics)} below 30%</span></>}
              </div>
            )}
            {!topicsCollapsed && themeTopics.map((t) => <TopicButton key={t.id} topic={t} {...btnProps} />)}
          </div>
        )}

        {posTopics.length === 0 && themeTopics.length === 0 && (
          <div className="sidebar-empty">No topics found.</div>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div className="sidebar-footer">
        {addingTopic ? (
          <div className="sidebar-new-topic-wrap">
            <div className="sidebar-new-topic-form">
              <input
                className="sidebar-new-topic-input"
                placeholder="Topic name…"
                value={newTopicName}
                autoFocus
                maxLength={200}
                onChange={(e) => { setNewTopicName(e.target.value); setTopicError(null) }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTopicName.trim()) createTopicMutation.mutate()
                  if (e.key === 'Escape') { setAddingTopic(false); setNewTopicName(''); setTopicError(null) }
                }}
              />
              <button type="button" className="sidebar-new-topic-save" disabled={!newTopicName.trim() || createTopicMutation.isPending} onClick={() => createTopicMutation.mutate()}>
                {createTopicMutation.isPending ? '…' : 'Add'}
              </button>
              <button type="button" className="sidebar-new-topic-cancel" onClick={() => { setAddingTopic(false); setNewTopicName(''); setTopicError(null) }}>
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="1" y1="1" x2="13" y2="13"/><line x1="13" y1="1" x2="1" y2="13"/>
                </svg>
              </button>
            </div>
            {topicError && <div className="sidebar-new-topic-error">{topicError}</div>}
          </div>
        ) : (
          <button type="button" className="sidebar-add-topic-btn" onClick={() => setAddingTopic(true)}>
            + New topic
          </button>
        )}
        <div className="sidebar-util-row">
          <button type="button" className="sidebar-util-btn" title="Statistics" onClick={() => navigate('/stats')}>
            <span className="sidebar-util-icon">📊</span><span className="sidebar-util-label">Stats</span>
          </button>
          <button type="button" className="sidebar-util-btn" title="Trash" onClick={() => navigate('/trash')}>
            <span className="sidebar-util-icon">🗑</span><span className="sidebar-util-label">Trash</span>
          </button>
        </div>
      </div>

      {deleteTopicId !== null && (
        <ConfirmModal
          title="Delete Topic?"
          message={`Are you sure you want to delete "${topics.find(t => t.id === deleteTopicId)?.name}"? This will move the topic and all its words to trash.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => deleteTopicMutation.mutate(deleteTopicId)}
          onCancel={() => setDeleteTopicId(null)}
        />
      )}
    </>
  )
}

function SortMenu({options, current, anchorRef, onSelect, onClose}: {
  options: {value: SortMode; label: string}[]
  current: SortMode
  anchorRef: React.RefObject<HTMLButtonElement | null>
  onSelect: (v: SortMode) => void
  onClose: () => void
}) {
  const rect = anchorRef.current?.getBoundingClientRect()
  const menuHeight = options.length * 36 + 8
  const spaceBelow = rect ? window.innerHeight - rect.bottom : 999
  const style = rect
    ? spaceBelow >= menuHeight
      ? {top: rect.bottom + 4, right: window.innerWidth - rect.right}
      : {bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right}
    : {top: 0, right: 0}
  return createPortal(
    <>
      <div className="sidebar-sort-overlay" onClick={onClose} />
      <div className="sidebar-sort-menu" style={{...style, position: 'fixed'}}>
        {options.map((o) => (
          <button key={o.value} type="button" className={`sidebar-sort-option ${current === o.value ? 'active' : ''}`} onClick={() => onSelect(o.value)}>
            {o.label}
            {current === o.value && (
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <polyline points="2,6 5,9 10,3" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </>,
    document.body,
  )
}

function TopicButton({topic, topicCounts, topicProgress, selectedTopicId, isSmartReview, pinnedIds, onSelect, onDelete, onPin}: {
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
  return (
    <div
      className={`topic-item ${!isSmartReview && topic.id === selectedTopicId ? 'topic-item-active' : ''}`}
      data-pinned={isPinned ? 'true' : undefined}
      title={topic.name}
    >
      <button type="button" className="topic-item-select" onClick={() => onSelect(topic.id)}>
        <span className="topic-item-name">{topic.name}</span>
        {progress !== undefined && progress > 0 && <span className="topic-item-pct">{progress}%</span>}
        <span className="topic-count">{topicCounts.get(topic.id) ?? 0}</span>
      </button>
      <div className="topic-item-actions">
        <button type="button" className={`topic-item-pin ${isPinned ? 'pinned' : ''}`} title={isPinned ? 'Unpin' : 'Pin'} onClick={(e) => { e.stopPropagation(); onPin(topic.id) }}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill={isPinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M5 1l1 3-3 2 1 1 2-1 1 4 1-4 2 1 1-1-3-2 1-3z" />
          </svg>
        </button>
        <span className="topic-item-actions-sep" />
        <button type="button" className="topic-item-delete" title="Delete topic" onClick={(e) => { e.stopPropagation(); onDelete(topic.id) }}>
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
