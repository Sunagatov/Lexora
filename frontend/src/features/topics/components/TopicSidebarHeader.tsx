import {useEffect, useRef, useState, useSyncExternalStore} from 'react'
import {useLocation, useNavigate} from 'react-router-dom'
import {routes} from '@/app/routes'
import {useIsMutating} from '@tanstack/react-query'
import {languagePreferences, subscribeLanguages} from '@/features/languages/api'
import {AccountIcon} from '@/features/preferences/AccountIcon'
import type {StudyQueue} from '@/features/smart-review/types/studyQueueTypes'

type Props = {
  topicSearch: string
  setTopicSearch: (value: string) => void
  isMobile: boolean
  isSmartReview: boolean
  onSelectSmartReview: () => void
  smartQueue: StudyQueue | null
}

export function TopicSidebarHeader({
  topicSearch,
  setTopicSearch,
  isMobile,
  isSmartReview,
  onSelectSmartReview,
  smartQueue,
}: Props) {
  const [searchOpen, setSearchOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const searchRef = useRef<HTMLInputElement>(null)
  const language = useSyncExternalStore(subscribeLanguages, languagePreferences)
  const pending = useIsMutating() > 0
  const editingWord = location.pathname.endsWith('/edit')

  function openMyLexora() {
    if (pending || editingWord) return

    const returnScrollTop = document.querySelector<HTMLElement>(
      '.word-collection-scroll, .all-words-page',
    )?.scrollTop ?? 0

    navigate(routes.account, {
      state: {
        returnTo: location.pathname + location.search + location.hash,
        returnLanguage: language.language,
        returnState: location.state,
        returnScrollTop,
      },
    })
  }

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
      <div className="sidebar-smart-review-wrap">
        <button
          type="button"
          className={`sidebar-smart-review-btn ripple-btn ${isSmartReview ? 'active' : ''}`}
          onClick={onSelectSmartReview}
          aria-label="Daily Word Mix"
          title="Daily Word Mix"
          data-sidebar-tooltip="Daily Word Mix"
        >
          <span className="sidebar-smart-review-title">
            <span className="sidebar-smart-review-emoji" aria-hidden="true">✨</span>
            <span className="sidebar-smart-review-text"> Daily Word Mix</span>
          </span>
          {remaining !== null && <span className="sidebar-smart-review-count">{remaining} left</span>}
          {smartQueue && (
            <div className="sidebar-smart-review-bar">
              <div className="sidebar-smart-review-fill" style={{width: `${smartReviewProgress}%`}} />
            </div>
          )}
        </button>
      </div>

      <nav className="sidebar-quicklinks" aria-label="Quick navigation">
        <button
          type="button"
          className={`sidebar-quicklink${location.pathname === routes.favorites ? ' is-active' : ''}`}
          onClick={() => navigate(routes.favorites)}
          aria-label="Favorites"
          aria-current={location.pathname === routes.favorites ? 'page' : undefined}
          data-sidebar-tooltip="Favorites"
          title="Favorites"
        >
          <AccountIcon name="heart" />
          <span>Favorites</span>
        </button>
        <button
          type="button"
          className="sidebar-quicklink"
          onClick={openMyLexora}
          disabled={pending || editingWord}
          aria-label="My Lexora"
          data-sidebar-tooltip="My Lexora"
          title={editingWord ? 'Finish editing before opening My Lexora' : 'My Lexora'}
        >
          <AccountIcon name="account" />
          <span>My Lexora</span>
        </button>
      </nav>

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
              <button type="button" className="sidebar-search-close ripple-btn" onClick={closeMobileSearch} aria-label="Close search">
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="1" y1="1" x2="13" y2="13" />
                  <line x1="13" y1="1" x2="1" y2="13" />
                </svg>
              </button>
            </div>
          ) : (
            <button type="button" className="sidebar-search-toggle ripple-btn" onClick={() => setSearchOpen(true)} aria-label="Search topics">
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
