import {useEffect} from 'react'
import {useStudyState} from '../hooks/useStudyState'
import {LEVELS, LEVEL_LABELS, levelClass} from '../lib/words'
import {TopicSidebar} from '../components/study/TopicSidebar'
import {Toolbar} from '../components/study/Toolbar'
import {WordTable} from '../components/study/WordTable'
import {WordCardList} from '../components/study/WordCardList'
import {Pagination} from '../components/study/Pagination'
import {SmartReviewView} from '../components/study/SmartReviewView'
import {useDrawer} from '../context/DrawerContext'

export function StudyPage() {
  const s = useStudyState()
  const {drawerOpen, setDrawerOpen, setHasDrawer} = useDrawer()

  useEffect(() => {
    setHasDrawer(true)
    return () => setHasDrawer(false)
  }, [setHasDrawer])

  const sidebarProps = {
    topics: s.visibleTopics,
    topicCounts: s.topicCounts,
    totalWords: s.words.length,
    topicSearch: s.topicSearch,
    setTopicSearch: s.setTopicSearch,
    selectedTopicId: s.selectedTopicId,
    isSmartReview: s.isSmartReview,
    onSelect: s.selectTopic,
    onSelectSmartReview: s.selectSmartReview,
    smartQueue: s.smartQueue,
  }

  if (s.isLoading) {
    return <div className="study-loading">Loading…</div>
  }

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
                  {LEVELS.map((l) => (
                    <div key={l} className={`level-chip ${levelClass(l)}`}>
                      <span className="level-chip-label">{LEVEL_LABELS[l]}</span>
                      <span className="level-chip-value">{s.levelSummary[l]}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Toolbar
                wordSearch={s.wordSearch}
                setWordSearch={s.setWordSearch}
                sortBy={s.sortBy}
                setSortBy={s.setSortBy}
                levelFilter={s.levelFilter}
                setLevelFilter={s.setLevelFilter}
                onReset={s.resetFilters}
                totalWordsOverall={s.overallWordCount}
                topicTotalCount={s.topicWordCount}
                filteredCount={s.filteredWordCount}
                pageStart={s.pageStart}
                pageEnd={s.pageEnd}
                levelSummary={s.levelSummary}
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
                    page={s.page}
                    totalPages={s.totalPages}
                    pageSize={s.pageSize}
                    onPageSize={s.setPageSize}
                    onPage={(p) => {
                      s.setPage(p)
                      document.querySelector('.main-content')?.scrollTo({top: 0, behavior: 'smooth'})
                    }}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
