import {Link, useLocation, useNavigate} from 'react-router-dom'
import {useSyncExternalStore} from 'react'
import {routes} from '@/app/routes'
import {WordRouteBreadcrumb} from '@/features/words/components/WordRouteBreadcrumb'
import {languagePreferences, languageProfile, subscribeLanguages} from '@/features/languages/api'
import {accountReturnTarget} from '@/features/preferences/accountNavigation'
import {OfflineStatus} from '@/features/offline/OfflineButton'

type Props = {
  hasDrawer?: boolean
  drawerOpen?: boolean
  onOpenDrawer?: () => void
  onAddWord?: () => void
  collectionHeadingRef?: (element: HTMLDivElement | null) => void
}

export function AppHeader({hasDrawer = false, drawerOpen = false, onOpenDrawer, onAddWord, collectionHeadingRef}: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const inAccount = location.pathname === routes.account || location.pathname.startsWith(`${routes.account}/`)
  const language = useSyncExternalStore(subscribeLanguages, languagePreferences)
  const profile = languageProfile(language.language)

  return (
    <header className={`app-header${collectionHeadingRef ? ' app-header-collection' : ''}`}>
      <div className="app-header-left">
        {collectionHeadingRef ? <>
          {location.pathname === routes.favorites ? (
            <Link to={routes.home} className="app-header-collection-back" aria-label="Back to All words">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m12 5-5 5 5 5" />
              </svg>
            </Link>
          ) : <img className="app-header-language-flag" src={profile.favicon} alt={profile.name} />}
          <div className="app-header-collection-title" ref={collectionHeadingRef} />
        </> : <>
          <button type="button" className="app-header-brand" onClick={() => {
            if (inAccount) {
              const target = accountReturnTarget(location.state, language.language)
              navigate(target.to, {state: target.state})
            } else navigate(routes.home)
          }}>
            <img className="app-header-language-flag" src={profile.favicon} alt="" />
            Lexora
          </button>
          <WordRouteBreadcrumb />
        </>}
      </div>
      <div className="app-header-actions">
        {!inAccount && <OfflineStatus />}
        {onAddWord && (
          <button type="button" className="app-header-add" onClick={onAddWord} aria-label="Add word" title="Add word">
            <span className="app-header-add-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M8 3v10M3 8h10" />
              </svg>
            </span>
            {!collectionHeadingRef && 'Add word'}
          </button>
        )}
        {hasDrawer && (
          <button type="button" className={`app-header-burger${inAccount ? ' account-burger' : ''}`} onClick={onOpenDrawer}
            aria-label={drawerOpen ? 'Close sidebar' : 'Open sidebar'} aria-expanded={drawerOpen} aria-controls="mobile-topic-drawer">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {drawerOpen ? <path d="M4 4l10 10M14 4L4 14" /> : <>
              <line x1="2" y1="4" x2="16" y2="4" />
              <line x1="2" y1="9" x2="16" y2="9" />
              <line x1="2" y1="14" x2="16" y2="14" />
              </>}
            </svg>
          </button>
        )}
      </div>
    </header>
  )
}
