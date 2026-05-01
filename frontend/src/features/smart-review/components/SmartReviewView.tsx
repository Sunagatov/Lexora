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

import {useMemo} from 'react'
import type {StudyQueue, WordKnowledgeLevel} from '@/shared/types'
import {useSmartReview} from '@/features/smart-review/hooks/useSmartReview'
import {useWordUpdate} from '@/features/words/hooks/useWordUpdate'
import {useWordFilter} from '@/features/words/hooks/useWordFilter'
import {WordCollectionView} from '@/features/words/components/WordCollectionView'
import {useResponsivePageSize} from '@/features/study/hooks/useResponsivePageSize'

type Props = {queue: StudyQueue | null; isLoading: boolean}

export function SmartReviewView({queue, isLoading}: Props) {
  const {completeItem, refresh, isRefreshing} = useSmartReview(false)
  const words  = useMemo(() => (queue?.items ?? []).map((item) => item.word), [queue])
  const defaultPageSize = useResponsivePageSize(20, 40)

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
  if (!queue) return <div className="empty-state">Daily Word Mix is unavailable.</div>

  const remaining  = queue.total_count - queue.completed_count
  const progress   = queue.total_count > 0 ? Math.round((queue.completed_count / queue.total_count) * 100) : 0
  const isComplete = remaining === 0 && queue.total_count > 0

  return (
    <>
      <div className="sticky-controls">
        <div className="card topic-header-card topic-header-card-desktop">
          <div className="topic-header-main">
            <div className="topic-header-title">✨ Daily Word Mix</div>
            <div className="smart-review-subtitle">
              {isComplete
                ? 'All done! Get a new set when you\'re ready.'
                : `${remaining} word${remaining !== 1 ? 's' : ''} left in this session — progress is saved`
              }
            </div>
          </div>
          <div className="smart-review-progress">
            <div className="smart-review-progress-bar">
              <div className="smart-review-progress-fill" style={{width: `${progress}%`}} />
            </div>
            <div className="smart-review-progress-footer">
              <span className="smart-review-progress-label">
                {queue.completed_count}/{queue.total_count} reviewed
              </span>
              <button
                type="button"
                className="smart-review-refresh-btn"
                onClick={() => refresh()}
                disabled={isRefreshing}
              >
                {isRefreshing ? 'Loading…' : isComplete ? '✨ New session' : '↺ New set'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <WordCollectionView
        wordSearch={filter.wordSearch} setWordSearch={filter.setWordSearch}
        sortBy={filter.sortBy} setSortBy={filter.setSortBy}
        levelFilter={filter.levelFilter} setLevelFilter={filter.setLevelFilter}
        onReset={filter.resetFilters}
        totalWordsOverall={words.length} topicTotalCount={words.length}
        filteredCount={filter.filteredWords.length}
        pageStart={filter.pageStart} pageEnd={filter.pageEnd}
        levelSummary={filter.levelSummary}
        pageWords={filter.pageWords} page={filter.page} totalPages={filter.totalPages}
        pageSize={filter.pageSize} setPageSize={filter.setPageSize} setPage={filter.setPage}
        pendingWordId={update.pendingWordId} onUpdate={handleUpdate}
      />
    </>
  )
}
