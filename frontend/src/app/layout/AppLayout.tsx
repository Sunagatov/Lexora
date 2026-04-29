import {Outlet} from 'react-router-dom'
import {AppHeader} from '@/app/layout/AppHeader'
import {AppFooter} from '@/app/layout/AppFooter'
import {UsageTracker} from '@/features/stats/components/UsageTracker'

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
