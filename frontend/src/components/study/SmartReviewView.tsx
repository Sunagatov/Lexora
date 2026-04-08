import type {StudyQueue, WordKnowledgeLevel} from '../../lib/api'
import {useSmartReview} from '../../hooks/useSmartReview'
import {useWordUpdate} from '../../hooks/useWordUpdate'
import {WordTable} from './WordTable'
import {WordCardList} from './WordCardList'
import {Pagination} from './Pagination'
import {useWordFilter} from '../../hooks/useWordFilter'
import {useMemo} from 'react'

type Props = {
  queue: StudyQueue | null
  isLoading: boolean
}

export function SmartReviewView({queue, isLoading}: Props) {
  const {completeItem} = useSmartReview()

  const words = useMemo(
    () => (queue?.items ?? []).map((item) => item.word),
    [queue],
  )

  const filter = useWordFilter(words, 0, queue?.id ?? null)

  const update = useWordUpdate(() =>
    filter.setFrozenIds((cur) => cur ?? filter.filteredWords.map((w) => w.id)),
  )

  function handleUpdate(wordId: number, level: WordKnowledgeLevel) {
    update.updateLevel(wordId, level)
    if (queue) {
      const item = queue.items.find((i) => i.word_id === wordId)
      if (item && !item.is_completed) completeItem(item.id)
    }
  }

  if (isLoading) return null

  if (!queue) {
    return <div className="empty-state">Smart Review is unavailable.</div>
  }

  const remaining = queue.total_count - queue.completed_count
  const progress  = queue.total_count > 0
    ? Math.round((queue.completed_count / queue.total_count) * 100)
    : 0

  return (
    <>
      <div className="sticky-controls">
        <div className="card topic-header-card topic-header-card-desktop">
          <div className="topic-header-main">
            <div className="topic-header-title">⚡ Smart Review</div>
          </div>
          <div className="smart-review-progress">
            <div className="smart-review-progress-bar">
              <div className="smart-review-progress-fill" style={{width: `${progress}%`}} />
            </div>
            <span className="smart-review-progress-label">
              {queue.completed_count}/{queue.total_count} completed · {remaining} remaining
            </span>
          </div>
        </div>

        {filter.filteredWords.length > 0 && (
          <div className="word-list-header" aria-hidden="true">
            <span className="word-list-header-cell">Word</span>
            <span className="word-list-header-cell">Translation / details</span>
            <span className="word-list-header-cell word-list-header-knowledge">Knowledge</span>
          </div>
        )}
      </div>

      <div className="main-inner">
        {filter.pageWords.length === 0 ? (
          <div className="empty-state">No words in this queue.</div>
        ) : (
          <>
            <WordTable words={filter.pageWords} pendingWordId={update.pendingWordId} onUpdate={handleUpdate} />
            <WordCardList words={filter.pageWords} pendingWordId={update.pendingWordId} onUpdate={handleUpdate} />
          </>
        )}

        <div className="pagination-bar">
          <Pagination
            page={filter.page}
            totalPages={filter.totalPages}
            pageSize={filter.pageSize}
            onPageSize={filter.setPageSize}
            onPage={(p) => {
              filter.setPage(p)
              document.querySelector('.main-content')?.scrollTo({top: 0, behavior: 'smooth'})
            }}
          />
        </div>
      </div>
    </>
  )
}
