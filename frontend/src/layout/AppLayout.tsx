import {Outlet} from 'react-router-dom'
import {AppHeader} from './AppHeader'
import {AppFooter} from './AppFooter'
import {UsageTracker} from '../features/stats/UsageTracker'

export function AppLayout() {
  return (
    <div className="app-shell">
      <UsageTracker />
      <AppHeader />
      <div className="app-body">
        <Outlet />
      </div>
      <AppFooter />
    </div>
  )
}
