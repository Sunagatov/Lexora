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
import {useResponsivePageSize} from '@/shared/hooks/useResponsivePageSize'
import {useIsMobile} from '@/shared/hooks/useIsMobile'
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
        <div className="smart-review-header">
          <div className="smart-review-header-left">
            <span className="smart-review-header-title">✨ Daily Word Mix</span>
            <div className="smart-review-header-bar">
              <div className="smart-review-header-bar-fill" style={{width: `${progress}%`}} />
            </div>
            <span className="smart-review-header-stat">
              {queue.completed_count}/{queue.total_count}
            </span>
            {isComplete && <span className="smart-review-header-done">✓</span>}
          </div>
          <button
            type="button"
            className="smart-review-header-btn ripple-btn"
            onClick={() => refresh()}
            disabled={isRefreshing}
          >
            {isRefreshing ? '…' : isComplete ? '✨ New' : '↺ New set'}
          </button>
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
