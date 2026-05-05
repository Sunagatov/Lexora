function SmartReviewSkeleton() {
  return (
    <>
      <div className="sticky-controls">
        <div className="card topic-header-card topic-header-card-desktop">
          <div className="topic-header-main">
            <div className="sk" style={{height: 18, width: 160, marginBottom: 6}} />
            <div className="sk" style={{height: 13, width: '75%'}} />
          </div>
          <div className="smart-review-progress">
            <div className="smart-review-progress-bar">
              <div className="sk" style={{height: '100%', width: '100%', borderRadius: 999}} />
            </div>
            <div className="smart-review-progress-footer">
              <div className="sk" style={{height: 12, width: 100}} />
              <div className="sk" style={{height: 28, width: 76, borderRadius: 8}} />
            </div>
          </div>
        </div>
      </div>
      <div className="main-inner">
        <div className="sk-rows">
          {Array.from({length: 8}, (_, i) => (
            <div key={i} className="sk-row">
              <div className="sk" style={{height: 14}} />
              <div className="sk" style={{height: 13, width: '65%'}} />
              <div className="sk" style={{height: 24, borderRadius: 20}} />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

import {useEffect, useMemo, useState} from 'react'
import {useNavigate} from 'react-router-dom'
import type {StudyQueue} from '@/features/smart-review/types/studyQueueTypes'
import type {WordKnowledgeLevel} from '@/features/words/types/wordTypes'
import {routes} from '@/app/routes'
import {useSmartReview} from '@/features/smart-review/hooks/useSmartReview'
import {useWordUpdate} from '@/features/words/hooks/useWordUpdate'
import {useWordFilter} from '@/features/words/hooks/useWordFilter'
import {WordCollectionView} from '@/features/words/components/WordCollectionView'
import {WordDetailPanel} from '@/features/words/components/WordDetailPanel'
import {useResponsivePageSize} from '@/shared/hooks/useResponsivePageSize'
import {useIsMobile} from '@/shared/hooks/useIsMobile'
import {Breadcrumb} from '@/shared/components/Breadcrumb'
import {EmptyState} from '@/shared/components/EmptyState'

type Props = {queue: StudyQueue | null; isLoading: boolean}

export function SmartReviewView({queue, isLoading}: Props) {
  const navigate = useNavigate()
  const {completeItem, refresh, isRefreshing} = useSmartReview(false)
  const words  = useMemo(() => (queue?.items ?? []).map((item) => item.word), [queue])
  const defaultPageSize = useResponsivePageSize(20, 40)
  const isMobile = useIsMobile(768)
  const [panelWordId, setPanelWordId] = useState<number | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const queueId = queue?.id ?? null
  const completedCount = queue?.completed_count ?? 0

  useEffect(() => { setPanelWordId(null) }, [queueId])
  useEffect(() => {
    if (queueId === null) return
    setIsTransitioning(true)
    const timer = window.setTimeout(() => setIsTransitioning(false), 240)
    return () => window.clearTimeout(timer)
  }, [completedCount, panelWordId, queueId])

  const filter = useWordFilter(words, {defaultPageSize})
  const update = useWordUpdate(
    () => filter.setFrozenIds((cur) => cur ?? filter.filteredWords.map((w) => w.id)),
    'smart_review',
  )

  async function handleUpdate(wordId: number, level: WordKnowledgeLevel) {
    try {
      await update.updateLevelAsync(wordId, level)
    } catch {
      return
    }
    if (queue) {
      const item = queue.items.find((i) => i.word_id === wordId)
      if (item && !item.is_completed) completeItem(item.id)
    }
  }

  if (isLoading) return <SmartReviewSkeleton />
  if (!queue) {
    return (
      <div className="main-inner">
        <EmptyState
          icon="✨"
          title="Daily Word Mix unavailable"
          description="Your smart review queue is empty or still being prepared. Try generating a new session."
          variant="info"
          actions={[{label: 'Back Home', onClick: () => navigate(routes.home), variant: 'secondary'}]}
        />
      </div>
    )
  }

  const remaining  = queue.total_count - queue.completed_count
  const progress   = queue.total_count > 0 ? Math.round((queue.completed_count / queue.total_count) * 100) : 0
  const isComplete = remaining === 0 && queue.total_count > 0
  const splitClassName = `word-collection-split smart-review-word-content${isTransitioning || isRefreshing ? ' is-loading' : ''}${panelWordId && !isMobile ? ' has-panel' : ''}`

  return (
    <div className="study-topic-panel">
      <div className="sticky-controls">
        <div className="card topic-header-card topic-header-card-desktop smart-review-stage-card">
          <div className="topic-header-main smart-review-stage-copy">
            <Breadcrumb items={[{label: 'Home', onClick: () => navigate(routes.home)}, {label: 'Daily Word Mix', isActive: true}]} />
            <div className="smart-review-title-row">
              <div className="topic-header-title">✨ Daily Word Mix</div>
              <span className={`smart-review-status-pill ${isComplete ? 'is-complete' : ''}`}>
                {isComplete ? 'Complete' : `${progress}% done`}
              </span>
            </div>
            <div className="smart-review-subtitle">
              {isComplete
                ? 'All done! Get a new set when you\'re ready.'
                : `${remaining} word${remaining !== 1 ? 's' : ''} left in this session — progress is saved`
              }
            </div>
          </div>
          <div className="smart-review-progress smart-review-progress-modern">
            <div className="smart-review-progress-bar">
              <div className="smart-review-progress-fill" style={{width: `${progress}%`}} />
            </div>
            <div className="smart-review-progress-footer">
              <span className="smart-review-progress-label">
                {queue.completed_count}/{queue.total_count} reviewed
              </span>
              <button
                type="button"
                className="smart-review-refresh-btn ripple-btn"
                onClick={() => refresh()}
                disabled={isRefreshing}
              >
                {isRefreshing ? 'Loading…' : isComplete ? '✨ New session' : '↺ New set'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={splitClassName}>
        <WordCollectionView
          wordSearch={filter.wordSearch} setWordSearch={filter.setWordSearch}
          sortBy={filter.sortBy} setSortBy={filter.setSortBy}
          levelFilter={filter.levelFilter} setLevelFilter={filter.setLevelFilter}
          posFilter={filter.posFilter} setPosFilter={filter.setPosFilter}
          cefrFilter={filter.cefrFilter} setCefrFilter={filter.setCefrFilter}
          completeness={filter.completeness} setCompleteness={filter.setCompleteness}
          onReset={filter.resetFilters}
          totalWordsOverall={words.length} topicTotalCount={words.length}
          filteredCount={filter.filteredWords.length}
          pageStart={filter.pageStart} pageEnd={filter.pageEnd}
          levelSummary={filter.levelSummary}
          pageWords={filter.pageWords} page={filter.page} totalPages={filter.totalPages}
          pageSize={filter.pageSize} setPageSize={filter.setPageSize} setPage={filter.setPage}
          pendingWordId={update.pendingWordId} onUpdate={handleUpdate}
          onWordSelect={isMobile ? undefined : setPanelWordId}
          selectedWordId={panelWordId}
        />
        {panelWordId !== null && !isMobile && (
          <WordDetailPanel
            wordId={panelWordId}
            words={filter.pageWords}
            onClose={() => setPanelWordId(null)}
            onNavigate={setPanelWordId}
          />
        )}
      </div>
    </div>
  )
}
