import {useLocation, useNavigate} from 'react-router-dom'
import {useSyncExternalStore} from 'react'
import {routes} from '@/app/routes'
import {WordRouteBreadcrumb} from '@/features/words/components/WordRouteBreadcrumb'
import {languagePreferences, languageProfile, subscribeLanguages} from '@/features/languages/api'
import {accountReturnTarget} from '@/features/preferences/accountNavigation'

type Props = {
  hasDrawer?: boolean
  drawerOpen?: boolean
  onOpenDrawer?: () => void
}

export function AppHeader({hasDrawer = false, drawerOpen = false, onOpenDrawer}: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const inAccount = location.pathname === routes.account || location.pathname.startsWith(`${routes.account}/`)
  const language = useSyncExternalStore(subscribeLanguages, languagePreferences)
  const profile = languageProfile(language.language)

  return (
    <header className="app-header">
      <div className="app-header-left">
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
      </div>
      <div className="app-header-actions">
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
