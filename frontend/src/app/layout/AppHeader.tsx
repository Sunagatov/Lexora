import {useNavigate} from 'react-router-dom'
import {routes} from '@/app/routes'
import {useLogoutAction} from '@/features/auth/hooks/useLogoutAction'
import {WordRouteBreadcrumb} from '@/features/words/components/WordRouteBreadcrumb'
import {useTheme} from '@/shared/hooks/useTheme'

type Props = {
  hasDrawer?: boolean
  drawerOpen?: boolean
  onOpenDrawer?: () => void
}

export function AppHeader({hasDrawer = false, drawerOpen = false, onOpenDrawer}: Props) {
  const navigate = useNavigate()
  const {logoutPending, handleLogout} = useLogoutAction()
  const {isDark, toggle} = useTheme()

  return (
    <header className="app-header">
      <div className="app-header-left">
        <button type="button" className="app-header-brand" onClick={() => navigate(routes.home)}>
          <img src="/favicon.svg" alt="" width="20" height="10" />
          Lexora
        </button>
        <WordRouteBreadcrumb />
      </div>
      <div className="app-header-actions">
        <button type="button" className="app-header-theme-toggle" onClick={toggle} aria-label="Toggle dark mode">
          {isDark ? '☀️' : '🌙'}
        </button>
        <button type="button" className="app-header-logout" onClick={handleLogout} disabled={logoutPending}>
          {logoutPending ? 'Signing out…' : 'Sign out'}
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
