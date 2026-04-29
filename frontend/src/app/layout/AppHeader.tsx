import {useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {useQueryClient} from '@tanstack/react-query'
import {routes} from '@/app/routes'
import {useDrawer} from '@/app/layout/DrawerContext'
import {logout} from '@/features/auth/api/authApi'

export function AppHeader() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const {hasDrawer, setDrawerOpen} = useDrawer()
  const [logoutPending, setLogoutPending] = useState(false)

  async function handleLogout() {
    if (logoutPending) return

    setLogoutPending(true)
    try {
      await logout()
      queryClient.clear()
      navigate(routes.login, {replace: true})
    } finally {
      setLogoutPending(false)
    }
  }

  return (
    <header className="app-header">
      <button type="button" className="app-header-brand" onClick={() => navigate(routes.home)}>
        Lexora
      </button>
      <div className="app-header-actions">
        <button type="button" className="app-header-logout" onClick={handleLogout} disabled={logoutPending}>
          {logoutPending ? 'Signing out…' : 'Sign out'}
        </button>
        {hasDrawer && (
          <button type="button" className="app-header-burger" onClick={() => setDrawerOpen(true)}>
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
