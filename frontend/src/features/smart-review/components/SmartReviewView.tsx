function SmartReviewSkeleton() {
  return (
    <>
      <div className="sticky-controls">
        <div className="smart-review-header">
          <div className="smart-review-header-left">
            <div className="sk" style={{height: 14, width: 120, borderRadius: 4}} />
            <div className="sk" style={{height: 6, width: 140, borderRadius: 999}} />
            <div className="sk" style={{height: 12, width: 36, borderRadius: 4}} />
          </div>
          <div className="sk" style={{height: 26, width: 64, borderRadius: 8}} />
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
import {DEFAULT_PAGE_SIZE} from '@/shared/config/pagination'
import {useIsMobile} from '@/shared/hooks/useIsMobile'
import {EmptyState} from '@/shared/components/EmptyState'
import type {Topic} from '@/features/topics/types/topicTypes'

type Props = {queue: StudyQueue | null; isLoading: boolean; topics?: Topic[]}

export function SmartReviewView({queue, isLoading, topics = []}: Props) {
  const navigate = useNavigate()
  const review = useSmartReview(false)
  const {completeItem, refresh, isRefreshing} = review
  const [failedLevel, setFailedLevel] = useState<{wordId: number; level: WordKnowledgeLevel} | null>(null)
  const words  = useMemo(() => (queue?.items ?? []).map((item) => item.word), [queue])
  const defaultPageSize = DEFAULT_PAGE_SIZE
  const isMobile = useIsMobile(768)
  const [panelWordId, setPanelWordId] = useState<number | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const queueId = queue?.id ?? null
  const completedCount = queue?.completed_count ?? 0

  useEffect(() => { setPanelWordId(null); setFailedLevel(null) }, [queueId])
  useEffect(() => {
    if (queueId === null) return
    setIsTransitioning(true)
    const timer = window.setTimeout(() => setIsTransitioning(false), 240)
    return () => window.clearTimeout(timer)
  }, [completedCount, panelWordId, queueId])

  const filter = useWordFilter(words, {defaultPageSize, isLoading, topics})
  useEffect(() => {
    if (panelWordId !== null && !filter.pageWords.some(word => word.id === panelWordId)) {
      setPanelWordId(null)
    }
  }, [panelWordId, filter.pageWords])
  const update = useWordUpdate(
    () => filter.setFrozenIds((cur) => cur ?? filter.filteredWords.map((w) => w.id)),
    'smart_review',
  )

  async function handleUpdate(wordId: number, level: WordKnowledgeLevel) {
    setFailedLevel(null)
    try {
      await update.updateLevelAsync(wordId, level)
    } catch {
      setFailedLevel({wordId, level})
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
          description={review.loadError ? 'Could not load your word mix. Please try again.' : 'No word mix is available yet. Generate a new set to start reviewing.'}
          variant={review.loadError ? 'error' : 'info'}
          actions={[
            {label: review.loadError ? 'Retry' : 'Generate new set', onClick: review.loadError ? review.retry : () => refresh()},
            {label: 'Back Home', onClick: () => navigate(routes.home), variant: 'secondary'},
          ]}
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
      {failedLevel && <div role="alert" className="wp-save-error">
        Failed to save word level. Please try again.
        <button type="button" className="btn btn-ghost" onClick={() => handleUpdate(failedLevel.wordId, failedLevel.level)}>Retry</button>
      </div>}
      {review.actionError && <div role="alert" className="wp-save-error">
        {review.actionError}
        <button type="button" className="btn btn-ghost" onClick={review.retryAction}>Retry</button>
      </div>}
      <div className={splitClassName}>
        <WordCollectionView
          collectionTitle="Daily Word Mix"
          collectionAction={<button type="button" className="btn btn-ghost toolbar-mix-refresh" onClick={() => refresh()} disabled={isRefreshing}>
            {isRefreshing ? '…' : isComplete ? '✨ New' : '↺ New set'}
          </button>}
          collectionProgress={<div className="toolbar-mix-progress">
            <span>Reviewed {queue.completed_count}/{queue.total_count}{isComplete ? ' ✓' : ''}</span>
            <div className="smart-review-header-bar" role="progressbar" aria-label="Daily Word Mix completion" aria-valuemin={0} aria-valuemax={queue.total_count || 1} aria-valuenow={queue.completed_count}>
              <div className="smart-review-header-bar-fill" style={{width: `${progress}%`}} />
            </div>
          </div>}
          progressLabel="Daily Word Mix knowledge"
          wordSearch={filter.wordSearch} setWordSearch={filter.setWordSearch}
          sortBy={filter.sortBy} setSortBy={filter.setSortBy}
          thenSortBy={filter.thenSortBy} setThenSortBy={filter.setThenSortBy}
          topicFilter={filter.topicFilter} setTopicFilter={filter.setTopicFilter} topics={topics}
          onLearningSort={filter.setLearningSort}
          levelFilter={filter.levelFilter} setLevelFilter={filter.setLevelFilter}
          posFilter={filter.posFilter} setPosFilter={filter.setPosFilter}
          cefrFilter={filter.cefrFilter} setCefrFilter={filter.setCefrFilter}
          completeness={filter.completeness} setCompleteness={filter.setCompleteness}
          onReset={filter.resetFilters}
          totalWordsOverall={words.length} topicTotalCount={words.length}
          filteredCount={filter.filteredWords.length}
          pageStart={filter.pageStart} pageEnd={filter.pageEnd}
          levelSummary={filter.levelSummary}
          pageWords={filter.pageWords} navigationWords={filter.filteredWords} page={filter.page} totalPages={filter.totalPages}
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
