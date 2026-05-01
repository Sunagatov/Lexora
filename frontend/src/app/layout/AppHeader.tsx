import {useNavigate} from 'react-router-dom'
import {routes} from '@/app/routes'
import {useLogoutAction} from '@/features/auth/hooks/useLogoutAction'
import {WordRouteBreadcrumb} from '@/features/words/components/WordRouteBreadcrumb'

type Props = {
  hasDrawer?: boolean
  onOpenDrawer?: () => void
}

export function AppHeader({hasDrawer = false, onOpenDrawer}: Props) {
  const navigate = useNavigate()
  const {logoutPending, handleLogout} = useLogoutAction()

  return (
    <header className="app-header">
      <div className="app-header-left">
        <button type="button" className="app-header-brand" onClick={() => navigate(routes.home)}>
          Lexora
        </button>
        <WordRouteBreadcrumb />
      </div>
      <div className="app-header-actions">
        <button type="button" className="app-header-logout" onClick={handleLogout} disabled={logoutPending}>
          {logoutPending ? 'Signing out…' : 'Sign out'}
        </button>
        {hasDrawer && (
          <button type="button" className="app-header-burger" onClick={onOpenDrawer} aria-label="Open sidebar">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="2" y1="4" x2="16" y2="4" />
              <line x1="2" y1="9" x2="16" y2="9" />
              <line x1="2" y1="14" x2="16" y2="14" />
            </svg>
          </button>
        )}
      </div>
    </header>
  )
}
