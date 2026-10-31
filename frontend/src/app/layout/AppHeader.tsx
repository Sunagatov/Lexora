import {useLocation, useNavigate} from 'react-router-dom'
import {useSyncExternalStore} from 'react'
import {routes} from '@/app/routes'
import {WordRouteBreadcrumb} from '@/features/words/components/WordRouteBreadcrumb'
import {languagePreferences, languageProfile, subscribeLanguages} from '@/features/languages/api'
import {AccountIcon} from '@/features/preferences/AccountIcon'
import {useIsMutating} from '@tanstack/react-query'

type Props = {
  hasDrawer?: boolean
  drawerOpen?: boolean
  onOpenDrawer?: () => void
}

export function AppHeader({hasDrawer = false, drawerOpen = false, onOpenDrawer}: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const language = useSyncExternalStore(subscribeLanguages, languagePreferences)
  const profile = languageProfile(language.language)
  const accountActive = location.pathname.startsWith(routes.account)
  const pending = useIsMutating() > 0

  return (
    <header className="app-header">
      <div className="app-header-left">
        <button type="button" className="app-header-brand" onClick={() => navigate(routes.home)}>
          <img className="app-header-language-flag" src={profile.favicon} alt="" />
          Lexora
        </button>
        <WordRouteBreadcrumb />
      </div>
      <div className="app-header-actions">
        <button type="button" className={`app-header-account${accountActive ? ' is-active' : ''}`} aria-label="My Lexora" aria-current={accountActive ? 'page' : undefined}
          disabled={pending || location.pathname.endsWith('/edit')}
          title={location.pathname.endsWith('/edit') ? 'Finish editing before opening My Lexora' : 'My Lexora'}
          onClick={() => navigate(routes.account, {state: accountActive ? location.state : {returnTo: location.pathname + location.search, returnLanguage: language.language, returnScrollTop: document.querySelector('.word-collection-scroll, .all-words-page')?.scrollTop ?? 0}})}>
          <AccountIcon name="account" />
        </button>
        {hasDrawer && (
          <button type="button" className="app-header-burger" onClick={onOpenDrawer}
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
