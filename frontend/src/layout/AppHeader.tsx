import {useNavigate} from 'react-router-dom'
import {useDrawer} from '../shared/DrawerContext'

export function AppHeader() {
  const navigate = useNavigate()
  const {hasDrawer, setDrawerOpen} = useDrawer()

  return (
    <header className="app-header">
      <button type="button" className="app-header-brand" onClick={() => navigate('/')}>
        Lexora
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
    </header>
  )
}
