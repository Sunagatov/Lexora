import {useRef, useSyncExternalStore, type ReactNode} from 'react'
import {useLocation, useNavigate} from 'react-router-dom'
import {routes} from '@/app/routes'
import {useIsMutating} from '@tanstack/react-query'
import {languagePreferences, subscribeLanguages} from '@/features/languages/api'
import {AccountIcon} from '@/features/preferences/AccountIcon'
import {accountReturnTarget} from '@/features/preferences/accountNavigation'
import type {StudyQueue} from '@/features/smart-review/types/studyQueueTypes'
import {isIOSApp} from '@/shared/platform'

const offlineRoute = `${routes.account}/offline`

type Props = {
  topicSearch: string
  setTopicSearch: (value: string) => void
  isSmartReview: boolean
  onSelectSmartReview: () => void
  smartQueue: StudyQueue | null
  collapseControl?: ReactNode
}

export function TopicSidebarHeader({
  topicSearch,
  setTopicSearch,
  isSmartReview,
  onSelectSmartReview,
  smartQueue,
  collapseControl,
}: Props) {
  const location = useLocation()
  const navigate = useNavigate()
  const searchRef = useRef<HTMLInputElement>(null)
  const language = useSyncExternalStore(subscribeLanguages, languagePreferences)
  const pending = useIsMutating() > 0
  const editingWord = location.pathname.endsWith('/edit')

  function openAccount(destination: string) {
    if (pending || editingWord) return
    if (location.pathname === routes.account || location.pathname.startsWith(`${routes.account}/`)) {
      if (destination !== routes.account) {
        if (location.pathname !== destination) navigate(destination, {state: location.state})
        return
      }
      const target = accountReturnTarget(location.state, language.language)
      navigate(target.to, {state: target.state})
      return
    }

    const returnScrollTop = document.querySelector<HTMLElement>(
      '.word-collection-scroll, .all-words-page',
    )?.scrollTop ?? 0

    navigate(destination, {
      state: {
        returnTo: location.pathname + location.search + location.hash,
        returnLanguage: language.language,
        returnState: location.state,
        returnScrollTop,
      },
    })
  }

  const remaining = smartQueue ? smartQueue.total_count - smartQueue.completed_count : null
  const smartReviewProgress = smartQueue && smartQueue.total_count > 0
    ? Math.round((smartQueue.completed_count / smartQueue.total_count) * 100)
    : 0

  return (
    <>
      <nav className={`sidebar-quicklinks${isIOSApp ? ' sidebar-quicklinks-ios' : ''}`} aria-label="Quick navigation">
        <button
          type="button"
          className={`sidebar-quicklink sidebar-smart-review-btn ${isSmartReview ? 'active' : ''}`}
          onClick={onSelectSmartReview}
          aria-label="Daily Word Mix"
          title={remaining === null ? 'Daily Word Mix' : `Daily Word Mix · ${remaining} left`}
          aria-current={isSmartReview ? 'page' : undefined}
          data-sidebar-tooltip="Daily Word Mix"
        >
          <span className="sidebar-smart-review-emoji" aria-hidden="true">✨</span>
          <span className="sidebar-smart-review-text">Daily Mix</span>
          {smartQueue && (
            <div className="sidebar-smart-review-bar">
              <div className="sidebar-smart-review-fill" style={{width: `${smartReviewProgress}%`}} />
            </div>
          )}
        </button>
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
          onClick={() => openAccount(routes.account)}
          disabled={pending || editingWord}
          aria-label="My Lexora"
          data-sidebar-tooltip="My Lexora"
          title={editingWord ? 'Finish editing before opening My Lexora' : 'My Lexora'}
        >
          <AccountIcon name="account" />
          <span>My Lexora</span>
        </button>
        {isIOSApp && (
          <button
            type="button"
            className={`sidebar-quicklink${location.pathname === offlineRoute ? ' is-active' : ''}`}
            onClick={() => openAccount(offlineRoute)}
            disabled={pending || editingWord}
            aria-current={location.pathname === offlineRoute ? 'page' : undefined}
            data-sidebar-tooltip="Offline"
          >
            <AccountIcon name="offline" />
            <span>Offline</span>
          </button>
        )}
      </nav>

      <div className="sidebar-search-row">
        <div className="sidebar-search-wrap">
          <div className="sidebar-search-field">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <circle cx="6.5" cy="6.5" r="4.5" />
              <path d="M10 10l4 4" />
            </svg>
            <input ref={searchRef} className="sidebar-search" type="search" aria-label="Search topics"
              placeholder="Search topics…" value={topicSearch}
              onChange={event => setTopicSearch(event.target.value)} />
            {topicSearch !== '' && <button type="button" className="sidebar-search-close" aria-label="Clear topic search"
              onClick={() => { setTopicSearch(''); searchRef.current?.focus({preventScroll: true}) }}>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m2 2 10 10M12 2 2 12" /></svg>
            </button>}
          </div>
        </div>
        {collapseControl}
      </div>
    </>
  )
}
