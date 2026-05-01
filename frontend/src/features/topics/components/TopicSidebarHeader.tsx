import {useEffect, useRef, useState} from 'react'
import type {StudyQueue} from '@/features/smart-review/types/studyQueueTypes'

type Props = {
  topicCount: number
  totalWords: number
  topicSearch: string
  setTopicSearch: (value: string) => void
  isMobile: boolean
  isSmartReview: boolean
  onSelectSmartReview: () => void
  smartQueue: StudyQueue | null
}

export function TopicSidebarHeader({
  topicCount,
  totalWords,
  topicSearch,
  setTopicSearch,
  isMobile,
  isSmartReview,
  onSelectSmartReview,
  smartQueue,
}: Props) {
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!searchOpen) return
    const timeoutId = window.setTimeout(() => searchRef.current?.focus(), 60)
    return () => window.clearTimeout(timeoutId)
  }, [searchOpen])

  const remaining = smartQueue ? smartQueue.total_count - smartQueue.completed_count : null
  const smartReviewProgress = smartQueue && smartQueue.total_count > 0
    ? Math.round((smartQueue.completed_count / smartQueue.total_count) * 100)
    : 0

  function closeMobileSearch() {
    setSearchOpen(false)
    setTopicSearch('')
  }

  return (
    <>
      <div className="sidebar-counts">
        <span>{topicCount} topics</span>
        <span className="sidebar-counts-sep">·</span>
        <span>{totalWords.toLocaleString()} words</span>
      </div>

      <div className="sidebar-smart-review-wrap">
        <button type="button" className={`sidebar-smart-review-btn ${isSmartReview ? 'active' : ''}`} onClick={onSelectSmartReview}>
          <span className="sidebar-smart-review-title">✨ Daily Word Mix</span>
          {remaining !== null && <span className="sidebar-smart-review-count">{remaining} left</span>}
          {smartQueue && (
            <div className="sidebar-smart-review-bar">
              <div className="sidebar-smart-review-fill" style={{width: `${smartReviewProgress}%`}} />
            </div>
          )}
        </button>
      </div>

      <div className="sidebar-search-wrap">
        {isMobile ? (
          searchOpen ? (
            <div className="sidebar-search-mobile-row">
              <input
                ref={searchRef}
                className="sidebar-search"
                type="text"
                placeholder="Search topics…"
                value={topicSearch}
                onChange={(event) => setTopicSearch(event.target.value)}
              />
              <button type="button" className="sidebar-search-close" onClick={closeMobileSearch} aria-label="Close search">
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="1" y1="1" x2="13" y2="13" />
                  <line x1="13" y1="1" x2="1" y2="13" />
                </svg>
              </button>
            </div>
          ) : (
            <button type="button" className="sidebar-search-toggle" onClick={() => setSearchOpen(true)} aria-label="Search topics">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="6.5" cy="6.5" r="4.5" />
                <line x1="10" y1="10" x2="14" y2="14" />
              </svg>
              <span>Search</span>
            </button>
          )
        ) : (
          <input
            className="sidebar-search"
            type="text"
            placeholder="Search topics…"
            value={topicSearch}
            onChange={(event) => setTopicSearch(event.target.value)}
          />
        )}
      </div>
    </>
  )
}
