import {useEffect, useMemo, useState} from 'react'
import {useNavigate, useOutletContext} from 'react-router-dom'
import {useQuery} from '@tanstack/react-query'
import {routes} from '@/app/routes'
import {queryKeys} from '@/app/queryKeys'
import type {AppLayoutOutletContext} from '@/app/layout/AppLayout'
import {fetchTopics, fetchTopicSidebarStats} from '@/features/topics/api/topicsApi'
import {useTopicState} from '@/features/topics/hooks/useTopicState'
import {StudySidebarShell} from '@/features/study/components/StudySidebarShell'
import {useResizableSidebarWidth} from '@/features/study/hooks/useResizableSidebarWidth'
import {useSidebarCollapsedPref} from '@/features/study/hooks/useSidebarCollapsedPref'
import {useVocabulary} from '@/features/words/hooks/useVocabulary'
import {useWordUpdate} from '@/features/words/hooks/useWordUpdate'
import {WordCollectionView} from '@/features/words/components/WordCollectionView'
import {WordDetailPanel} from '@/features/words/components/WordDetailPanel'
import {useIsMobile} from '@/shared/hooks/useIsMobile'
import type {WordKnowledgeLevel} from '@/features/words/types/wordTypes'

function numericMap(values: Record<number, number> = {}) {
  return new Map(Object.entries(values).map(([id, count]) => [Number(id), count]))
}

export function VocabularyPage() {
  const navigate = useNavigate()
  const {drawerOpen, setDrawerOpen} = useOutletContext<AppLayoutOutletContext>()
  const {sidebarWidth, isResizing, handleSidebarResizeDown} = useResizableSidebarWidth()
  const {collapsed, setCollapsed} = useSidebarCollapsedPref()
  const isMobile = useIsMobile(768)
  const topicsQuery = useQuery({queryKey: queryKeys.topics, queryFn: fetchTopics})
  const sidebarQuery = useQuery({queryKey: queryKeys.topicSidebar, queryFn: fetchTopicSidebarStats})
  const topics = useMemo(() => topicsQuery.data ?? [], [topicsQuery.data])
  const topicState = useTopicState(topics)
  const topicCounts = useMemo(() => numericMap(sidebarQuery.data?.topic_counts), [sidebarQuery.data])
  const topicProgress = useMemo(() => numericMap(sidebarQuery.data?.topic_progress), [sidebarQuery.data])
  const s = useVocabulary()
  const update = useWordUpdate(() => {})
  const [actionError, setActionError] = useState<string | null>(null)
  const [panelWordId, setPanelWordId] = useState<number | null>(null)
  const words = useMemo(() => s.wordsQuery.data?.words ?? [], [s.wordsQuery.data])
  const total = s.summaryQuery.data?.total ?? 0
  const counts = s.summaryQuery.data?.level_counts
  const strong = counts?.[4] ?? 0
  const progress = total > 0 ? Math.round(strong / total * 100) : 0
  const levelSummary = {1: counts?.[1] ?? 0, 2: counts?.[2] ?? 0, 3: counts?.[3] ?? 0, 4: strong, 5: counts?.[5] ?? 0}
  const filteredCount = s.wordsQuery.data?.total ?? 0
  const pageStart = words.length ? (s.page - 1) * s.pageSize + 1 : 0
  const pageEnd = words.length ? pageStart + words.length - 1 : 0
  const hasFilters = !!(s.wordSearch || s.levelFilter !== 'all' || s.cefrFilter || s.posFilter || s.topicFilter.length || s.completeness !== 'all')
  const queries = [s.wordsQuery, s.summaryQuery, topicsQuery, sidebarQuery]
  const loadError = queries.some(query => query.isError)

  useEffect(() => {
    if (s.wordsQuery.isSuccess && panelWordId !== null && !words.some(word => word.id === panelWordId)) setPanelWordId(null)
  }, [words, s.wordsQuery.isSuccess, panelWordId])

  async function handleUpdate(id: number, level: WordKnowledgeLevel) {
    setActionError(null)
    try { await update.updateLevelAsync(id, level) }
    catch { setActionError('Failed to update word. Please try again.') }
  }

  function openDailyMix() { setDrawerOpen(false); navigate(routes.smartReview) }

  return (
    <>
      <StudySidebarShell
        drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen}
        sidebarWidth={sidebarWidth} sidebarCollapsed={collapsed}
        isResizing={isResizing} handleSidebarResizeDown={handleSidebarResizeDown}
        sidebarProps={{
          topics, topicCounts, topicProgress, totalWords: total,
          topicSearch: topicState.topicSearch, setTopicSearch: topicState.setTopicSearch,
          selectedTopicId: null, isSmartReview: false, smartQueue: null,
          onSelect: id => { setDrawerOpen(false); topicState.selectTopic(id) },
          onSelectSmartReview: openDailyMix,
          isCollapsed: collapsed, onToggleCollapsed: () => setCollapsed(!collapsed),
        }}
      />
      <div className="main-content">
        <div className="study-topic-panel vocabulary-panel">
          <div className="vocabulary-header card">
            <h1>My Vocabulary</h1>
            {s.summaryQuery.isSuccess ? (
              <div className="vocabulary-progress">
                <div className="vocabulary-progress-label"><span>Strong words</span><span>{strong} / {total} · {progress}%</span></div>
                <div className="toolbar-progress-bar" role="progressbar" aria-label="Whole vocabulary knowledge" aria-valuemin={0} aria-valuemax={total || 1} aria-valuenow={strong} aria-valuetext={`${strong} strong words out of ${total}`}>
                  <div className="toolbar-progress-seg level-4" style={{width: `${total ? strong / total * 100 : 0}%`}} />
                </div>
              </div>
            ) : <span className="vocabulary-progress-status">{s.summaryQuery.isError ? 'Vocabulary progress unavailable' : 'Loading vocabulary progress…'}</span>}
          </div>
          {(loadError || actionError) && <div role="alert" className="wp-save-error">
            {loadError ? 'Failed to load vocabulary. Please try again.' : actionError}
            {loadError && <button type="button" className="btn btn-ghost" onClick={() => { queries.forEach(query => { void query.refetch() }) }}>Retry</button>}
          </div>}
          {!s.wordsQuery.isError && <div className={`word-collection-split${panelWordId !== null && !isMobile ? ' has-panel' : ''}`}>
            <WordCollectionView
              wordSearch={s.wordSearch} setWordSearch={s.setWordSearch}
              sortBy={s.sortBy} setSortBy={s.setSortBy}
              thenSortBy={s.thenSortBy} setThenSortBy={s.setThenSortBy}
              topicFilter={s.topicFilter} setTopicFilter={s.setTopicFilter} topics={topics}
              onLearningSort={s.setLearningSort}
              levelFilter={s.levelFilter} setLevelFilter={s.setLevelFilter}
              posFilter={s.posFilter} setPosFilter={s.setPosFilter}
              cefrFilter={s.cefrFilter} setCefrFilter={s.setCefrFilter}
              completeness={s.completeness} setCompleteness={s.setCompleteness}
              onReset={s.resetFilters}
              totalWordsOverall={total} topicTotalCount={total} filteredCount={filteredCount}
              pageStart={pageStart} pageEnd={pageEnd} levelSummary={levelSummary}
              progressLabel="Whole vocabulary progress"
              pageWords={words} page={s.page} totalPages={s.totalPages}
              pageSize={s.pageSize} setPageSize={s.setPageSize} setPage={s.setPage}
              pendingWordId={update.pendingWordId} onUpdate={handleUpdate}
              isLoading={s.wordsQuery.isLoading}
              emptyMessage={hasFilters ? 'No words match the current filters.' : 'No words yet. Add a word in a topic to start your library.'}
              onWordSelect={isMobile ? undefined : setPanelWordId} selectedWordId={panelWordId}
            />
            {panelWordId !== null && !isMobile && <WordDetailPanel wordId={panelWordId} words={words} onClose={() => setPanelWordId(null)} onNavigate={setPanelWordId} />}
          </div>}
        </div>
      </div>
    </>
  )
}
