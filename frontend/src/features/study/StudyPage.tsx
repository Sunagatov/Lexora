import {useEffect, useState} from 'react'
import {useStudyState} from './useStudyState'
import {ACTIVE_LEVELS, PARKED_LEVEL, LEVEL_LABELS, levelClass} from '../../shared/wordDomain'
import {TopicSidebar} from '../topics/TopicSidebar'
import {Toolbar} from './Toolbar'
import {Pagination} from './Pagination'
import {WordTable} from '../words/WordTable'
import {WordCardList} from '../words/WordCardList'
import {SmartReviewView} from '../smart-review/SmartReviewView'
import {QuickAddSheet} from '../words/QuickAddSheet'
import {useDrawer} from '../../shared/DrawerContext'

export function StudyPage() {
  const s = useStudyState()
  const {drawerOpen, setDrawerOpen, setHasDrawer} = useDrawer()
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  useEffect(() => {
    setHasDrawer(true)
    return () => setHasDrawer(false)
  }, [setHasDrawer])

  const sidebarProps = {
    topics: s.visibleTopics, topicCounts: s.topicCounts, topicProgress: s.topicProgress,
    totalWords: s.words.length,
    topicSearch: s.topicSearch, setTopicSearch: s.setTopicSearch,
    selectedTopicId: s.selectedTopicId, isSmartReview: s.isSmartReview,
    onSelect: s.selectTopic, onSelectSmartReview: s.selectSmartReview,
    smartQueue: s.smartQueue,
  }

  if (s.isLoading) return <div className="study-loading">Loading…</div>

  return (
    <>
      <div className={`mobile-drawer-overlay ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(false)} />
      <div className={`mobile-drawer ${drawerOpen ? 'open' : ''}`}>
        <TopicSidebar {...sidebarProps} />
      </div>

      <aside className="desktop-sidebar">
        <TopicSidebar {...sidebarProps} />
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

              <Toolbar
                wordSearch={s.wordSearch} setWordSearch={s.setWordSearch}
                sortBy={s.sortBy} setSortBy={s.setSortBy}
                levelFilter={s.levelFilter} setLevelFilter={s.setLevelFilter}
                onReset={s.resetFilters}
                totalWordsOverall={s.overallWordCount} topicTotalCount={s.topicWordCount}
                filteredCount={s.filteredWordCount} pageStart={s.pageStart} pageEnd={s.pageEnd}
                levelSummary={s.levelSummary}
                topicName={s.selectedTopic?.name}
              />

              {s.selectedTopicId !== null && s.filteredWords.length > 0 && (
                <div className="word-list-header" aria-hidden="true">
                  <span className="word-list-header-cell">Word</span>
                  <span className="word-list-header-cell">Translation / details</span>
                  <span className="word-list-header-cell word-list-header-knowledge">Knowledge</span>
                </div>
              )}
            </div>

            <div className="main-inner">
              {s.selectedTopicId === null ? (
                <div className="empty-state">Select a topic to start reviewing words.</div>
              ) : s.filteredWords.length === 0 ? (
                <div className="empty-state">No words match the current filters.</div>
              ) : (
                <>
                  <WordTable words={s.pageWords} pendingWordId={s.pendingWordId} onUpdate={s.updateLevel} />
                  <WordCardList words={s.pageWords} pendingWordId={s.pendingWordId} onUpdate={s.updateLevel} />
                </>
              )}
              {s.selectedTopicId !== null && (
                <div className="pagination-bar">
                  <Pagination
                    page={s.page} totalPages={s.totalPages}
                    pageSize={s.pageSize} onPageSize={s.setPageSize}
                    onPage={(p) => { s.setPage(p); document.querySelector('.main-content')?.scrollTo({top: 0, behavior: 'smooth'}) }}
                  />
                </div>
              )}
            </div>
          </>
        )}

        <button
          type="button"
          className="fab"
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
