import {Outlet} from 'react-router-dom'
import {AppHeader} from './AppHeader'
import {AppFooter} from './AppFooter'

export function AppLayout() {
  return (
    <div className="app-shell">
      <AppHeader />
      <div className="app-body">
        <Outlet />
      </div>
      <AppFooter />
    </div>
  )
}
