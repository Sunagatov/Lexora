import {useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent} from 'react'
import {useStudyState} from './useStudyState'
import {ACTIVE_LEVELS, PARKED_LEVEL, LEVEL_LABELS, levelClass} from '../../shared/wordDomain'
import {TopicSidebar} from '../topics/TopicSidebar'
import {SmartReviewView} from '../smart-review/SmartReviewView'
import {QuickAddSheet} from '../words/QuickAddSheet'
import {WordCollectionView} from '../words/WordCollectionView'
import {useDrawer} from '../../shared/DrawerContext'

const SIDEBAR_WIDTH_KEY = 'study_sidebar_width'
const DEFAULT_SIDEBAR_WIDTH = 300
const MIN_SIDEBAR_WIDTH = 240
const MAX_SIDEBAR_WIDTH = 520

function clampSidebarWidth(width: number) {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width))
}

function loadSidebarWidth() {
  if (typeof window === 'undefined') return DEFAULT_SIDEBAR_WIDTH
  const raw = Number.parseInt(window.localStorage.getItem(SIDEBAR_WIDTH_KEY) ?? '', 10)
  return Number.isFinite(raw) ? clampSidebarWidth(raw) : DEFAULT_SIDEBAR_WIDTH
}

export function StudyPage() {
  const s = useStudyState()
  const {drawerOpen, setDrawerOpen, setHasDrawer} = useDrawer()
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(() => loadSidebarWidth())
  const [isResizing, setIsResizing] = useState(false)
  const dragStartRef = useRef({x: 0, width: sidebarWidth})
  const isResizingRef = useRef(isResizing)
  const resizeListenersRef = useRef<{
    move?: (event: PointerEvent) => void
    up?: () => void
  }>({})

  useEffect(() => {
    isResizingRef.current = isResizing
  }, [isResizing])

  useEffect(() => {
    if (isResizing) return
    window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth))
  }, [sidebarWidth, isResizing])

  useEffect(() => {
    setHasDrawer(true)
    setDrawerOpen(false)
    return () => {
      setHasDrawer(false)
      setDrawerOpen(false)
    }
  }, [setHasDrawer, setDrawerOpen])

  useEffect(() => {
    return () => {
      const {move, up} = resizeListenersRef.current
      if (move) window.removeEventListener('pointermove', move)
      if (up) {
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', up)
      }
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [])

  const sidebarProps = {
    topics: s.topics, topicCounts: s.topicCounts, topicProgress: s.topicProgress,
    totalWords: s.totalWords,
    topicSearch: s.topicSearch, setTopicSearch: s.setTopicSearch,
    selectedTopicId: s.selectedTopicId, isSmartReview: s.isSmartReview,
    onSelect: s.selectTopic, onSelectSmartReview: s.selectSmartReview,
    smartQueue: s.smartQueue,
  }
  const desktopSidebarStyle = {'--sidebar-w': `${sidebarWidth}px`} as CSSProperties

  function handleSidebarResizeDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    event.preventDefault()
    dragStartRef.current = {x: event.clientX, width: sidebarWidth}
    setIsResizing(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const move = (moveEvent: PointerEvent) => {
      if (!isResizingRef.current) return
      const nextWidth = clampSidebarWidth(dragStartRef.current.width + (moveEvent.clientX - dragStartRef.current.x))
      setSidebarWidth(nextWidth)
    }

    const up = () => {
      if (!isResizingRef.current) return
      setIsResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      resizeListenersRef.current = {}
    }

    resizeListenersRef.current = {move, up}
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  return (
    <>
      <div className={`mobile-drawer-overlay ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(false)} />
      <div className={`mobile-drawer ${drawerOpen ? 'open' : ''}`}>
        <TopicSidebar {...sidebarProps} isMobile />
      </div>

      <aside className={`desktop-sidebar ${isResizing ? 'is-resizing' : ''}`} style={desktopSidebarStyle}>
        <TopicSidebar {...sidebarProps} />
        <div
          className="desktop-sidebar-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          onPointerDown={handleSidebarResizeDown}
        />
      </aside>

      <div className="main-content">
        {s.isSmartReview ? (
          <SmartReviewView queue={s.smartQueue} isLoading={s.isLoading} />
        ) : (
          <>
            <div className="sticky-controls">
              <div className="card topic-header-card topic-header-card-desktop">
                <div className="topic-header-main">
                  <div className="topic-header-title">{s.selectedTopic?.name ?? 'No topic selected'}</div>
                </div>
                <div className="level-summary">
                  {ACTIVE_LEVELS.map((l) => (
                    <div key={l} className={`level-chip ${levelClass(l)}`}>
                      <span className="level-chip-label">{LEVEL_LABELS[l]}</span>
                      <span className="level-chip-value">{s.levelSummary[l]}</span>
                    </div>
                  ))}
                  {s.levelSummary[PARKED_LEVEL] > 0 && (
                    <div className={`level-chip ${levelClass(PARKED_LEVEL)} level-chip-parked`}>
                      <span className="level-chip-label">{LEVEL_LABELS[PARKED_LEVEL]}</span>
                      <span className="level-chip-value">{s.levelSummary[PARKED_LEVEL]}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {s.selectedTopicId === null ? (
              <div className="main-inner">
                <div className="empty-state">Select a topic to start reviewing words.</div>
              </div>
            ) : (
              <WordCollectionView
                wordSearch={s.wordSearch} setWordSearch={s.setWordSearch}
                sortBy={s.sortBy} setSortBy={s.setSortBy}
                levelFilter={s.levelFilter} setLevelFilter={s.setLevelFilter}
                onReset={s.resetFilters}
                totalWordsOverall={s.overallWordCount} topicTotalCount={s.topicWordCount}
                filteredCount={s.filteredWordCount} pageStart={s.pageStart} pageEnd={s.pageEnd}
                levelSummary={s.levelSummary} topicName={s.selectedTopic?.name}
                pageWords={s.pageWords} page={s.page} totalPages={s.totalPages}
                pageSize={s.pageSize} setPageSize={s.setPageSize} setPage={s.setPage}
                pendingWordId={s.pendingWordId} onUpdate={s.updateLevel}
                fromTopicSlug={s.selectedTopic?.slug}
                isLoading={s.isWordsLoading}
              />
            )}
          </>
        )}

        <button
          type="button"
          className={`fab ${drawerOpen ? 'fab-hidden' : ''}`}
          aria-label="Add word"
          onClick={() => setQuickAddOpen(true)}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="11" y1="3" x2="11" y2="19" />
            <line x1="3" y1="11" x2="19" y2="11" />
          </svg>
        </button>
      </div>

      {quickAddOpen && <QuickAddSheet onClose={() => setQuickAddOpen(false)} />}
    </>
  )
}
