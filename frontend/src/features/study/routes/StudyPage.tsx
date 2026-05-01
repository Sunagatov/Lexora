import {useEffect, useState} from 'react'
import {useStudyState} from '@/features/study/hooks/useStudyState'
import {SmartReviewView} from '@/features/smart-review/components/SmartReviewView'
import {QuickAddSheet} from '@/features/words/components/QuickAddSheet'
import {WordCollectionView} from '@/features/words/components/WordCollectionView'
import {useDrawer} from '@/app/layout/DrawerContext'
import {useResizableSidebarWidth} from '@/features/study/hooks/useResizableSidebarWidth'
import {StudySidebarShell} from '@/features/study/components/StudySidebarShell'
import {StudyTopicSummary} from '@/features/study/components/StudyTopicSummary'

export function StudyPage() {
  const s = useStudyState()
  const {drawerOpen, setDrawerOpen, setHasDrawer} = useDrawer()
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const {sidebarWidth, isResizing, handleSidebarResizeDown} = useResizableSidebarWidth()

  useEffect(() => {
    setHasDrawer(true)
    setDrawerOpen(false)
    return () => {
      setHasDrawer(false)
      setDrawerOpen(false)
    }
  }, [setHasDrawer, setDrawerOpen])

  const sidebarProps = {
    topics: s.topics, topicCounts: s.topicCounts, topicProgress: s.topicProgress,
    totalWords: s.totalWords,
    topicSearch: s.topicSearch, setTopicSearch: s.setTopicSearch,
    selectedTopicId: s.selectedTopicId, isSmartReview: s.isSmartReview,
    onSelect: (id: number) => { setDrawerOpen(false); s.selectTopic(id) },
    onSelectSmartReview: () => { setDrawerOpen(false); s.selectSmartReview() },
    smartQueue: s.smartQueue,
  }

  return (
    <>
      <StudySidebarShell
        drawerOpen={drawerOpen}
        setDrawerOpen={setDrawerOpen}
        sidebarWidth={sidebarWidth}
        isResizing={isResizing}
        handleSidebarResizeDown={handleSidebarResizeDown}
        sidebarProps={sidebarProps}
      />

      <div className="main-content">
        {s.isSmartReview ? (
          <SmartReviewView queue={s.smartQueue} isLoading={s.isLoading} />
        ) : (
          <>
            <StudyTopicSummary
              selectedTopicId={s.selectedTopicId}
              selectedTopicName={s.selectedTopic?.name}
              filteredWordCount={s.filteredWordCount}
              topicWordCount={s.topicWordCount}
              levelSummary={s.levelSummary}
            />

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
