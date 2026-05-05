import {useEffect, useMemo, useState} from 'react'
import {useNavigate, useOutletContext} from 'react-router-dom'
import type {AppLayoutOutletContext} from '@/app/layout/AppLayout'
import {routes} from '@/app/routes'
import {useStudyState} from '@/features/study/hooks/useStudyState'
import {SmartReviewView} from '@/features/smart-review/components/SmartReviewView'
import {WordCollectionView} from '@/features/words/components/WordCollectionView'
import {WordDetailPanel} from '@/features/words/components/WordDetailPanel'
import {useResizableSidebarWidth} from '@/features/study/hooks/useResizableSidebarWidth'
import {useSidebarCollapsedPref} from '@/features/study/hooks/useSidebarCollapsedPref'
import {useIsMobile} from '@/shared/hooks/useIsMobile'
import {StudySidebarShell} from '@/features/study/components/StudySidebarShell'
import {Breadcrumb} from '@/shared/components/Breadcrumb'
import {EmptyState} from '@/shared/components/EmptyState'
import type {Topic} from '@/features/topics/types/topicTypes'

function buildTopicBreadcrumbs(topics: Topic[], selectedTopic: Topic | null) {
  if (!selectedTopic) return []

  const topicsById = new Map(topics.map((topic) => [topic.id, topic]))
  const lineage: Topic[] = []
  const seen = new Set<number>()
  let current: Topic | undefined | null = selectedTopic

  while (current && !seen.has(current.id)) {
    lineage.push(current)
    seen.add(current.id)
    current = current.parent_topic_id ? topicsById.get(current.parent_topic_id) : null
  }

  return lineage.reverse()
}

export function StudyPage() {
  const navigate = useNavigate()
  const s = useStudyState()
  const {drawerOpen, setDrawerOpen} = useOutletContext<AppLayoutOutletContext>()
  const {sidebarWidth, isResizing, handleSidebarResizeDown} = useResizableSidebarWidth()
  const {collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed} = useSidebarCollapsedPref()
  const isMobile = useIsMobile(768)
  const [panelWordId, setPanelWordId] = useState<number | null>(null)

  useEffect(() => {
    setPanelWordId(null)
  }, [s.selectedTopicId])

  const selectedWord = useMemo(
    () => s.pageWords.find((word) => word.id === panelWordId) ?? null,
    [panelWordId, s.pageWords],
  )
  const topicBreadcrumbs = useMemo(
    () => buildTopicBreadcrumbs(s.topics, s.selectedTopic),
    [s.topics, s.selectedTopic],
  )

  const sidebarProps = {
    topics: s.topics, topicCounts: s.topicCounts, topicProgress: s.topicProgress,
    totalWords: s.totalWords,
    topicSearch: s.topicSearch, setTopicSearch: s.setTopicSearch,
    selectedTopicId: s.selectedTopicId, isSmartReview: s.isSmartReview,
    onSelect: (id: number) => { setDrawerOpen(false); s.selectTopic(id) },
    onSelectSmartReview: () => { setDrawerOpen(false); s.selectSmartReview() },
    smartQueue: s.smartQueue,
    isCollapsed: sidebarCollapsed,
    onToggleCollapsed: () => setSidebarCollapsed(!sidebarCollapsed),
  }

  return (
    <>
      <StudySidebarShell
        drawerOpen={drawerOpen}
        setDrawerOpen={setDrawerOpen}
        sidebarWidth={sidebarWidth}
        sidebarCollapsed={sidebarCollapsed}
        isResizing={isResizing}
        handleSidebarResizeDown={handleSidebarResizeDown}
        sidebarProps={sidebarProps}
      />

      <div className="main-content">
        {s.isSmartReview ? (
          <SmartReviewView queue={s.smartQueue} isLoading={s.isLoading} />
        ) : (
          <div className="study-topic-panel">
            <div className="main-inner study-breadcrumb-bar" style={{paddingBottom: 0}}>
              <Breadcrumb
                items={[
                  {label: 'Home', onClick: () => navigate(routes.home)},
                  ...topicBreadcrumbs.map((topic, index) => {
                    const isLastTopic = index === topicBreadcrumbs.length - 1
                    return ({
                    label: topic.name,
                    isActive: !selectedWord && isLastTopic,
                    onClick: !isLastTopic ? () => {
                      setPanelWordId(null)
                      s.selectTopic(topic.id)
                    } : undefined,
                  })
                  }),
                  ...(selectedWord ? [{label: selectedWord.term, isActive: true}] : []),
                ]}
              />
            </div>

            {s.selectedTopicId === null ? (
              <div className="main-inner">
                <EmptyState
                  icon="🧭"
                  title="Select a topic"
                  description="Choose a topic from the sidebar to start reviewing words and track progress."
                  variant="info"
                />
              </div>
            ) : (
              <div className={`word-collection-split${panelWordId && !isMobile ? ' has-panel' : ''}`}>
                <WordCollectionView
                  wordSearch={s.wordSearch} setWordSearch={s.setWordSearch}
                  sortBy={s.sortBy} setSortBy={s.setSortBy}
                  levelFilter={s.levelFilter} setLevelFilter={s.setLevelFilter}
                  posFilter={s.posFilter} setPosFilter={s.setPosFilter}
                  cefrFilter={s.cefrFilter} setCefrFilter={s.setCefrFilter}
                  completeness={s.completeness} setCompleteness={s.setCompleteness}
                  onReset={s.resetFilters}
                  totalWordsOverall={s.overallWordCount} topicTotalCount={s.topicWordCount}
                  filteredCount={s.filteredWordCount} pageStart={s.pageStart} pageEnd={s.pageEnd}
                  levelSummary={s.levelSummary}
                  pageWords={s.pageWords} page={s.page} totalPages={s.totalPages}
                  pageSize={s.pageSize} setPageSize={s.setPageSize} setPage={s.setPage}
                  pendingWordId={s.pendingWordId} onUpdate={s.updateLevel}
                  fromTopicSlug={s.selectedTopic?.slug}
                  isLoading={s.isWordsLoading}
                  onWordSelect={isMobile ? undefined : setPanelWordId}
                  selectedWordId={panelWordId}
                />
                {panelWordId !== null && !isMobile && (
                  <WordDetailPanel
                    wordId={panelWordId}
                    words={s.pageWords}
                    fromTopicSlug={s.selectedTopic?.slug}
                    onClose={() => setPanelWordId(null)}
                    onNavigate={setPanelWordId}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
