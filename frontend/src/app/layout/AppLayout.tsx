import {Outlet, useLocation} from 'react-router-dom'
import {useEffect, useState} from 'react'
import {AppHeader} from '@/app/layout/AppHeader'
import {AppFooter} from '@/app/layout/AppFooter'
import {UsageTracker} from '@/features/stats/components/UsageTracker'
import {routes} from '@/app/routes'

export type AppLayoutOutletContext = {
  drawerOpen: boolean
  setDrawerOpen: (open: boolean) => void
}

function isStudyRoute(pathname: string) {
  return pathname === routes.smartReview || pathname.startsWith('/topics/')
}

export function AppLayout() {
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const hasDrawer = isStudyRoute(location.pathname)

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  return (
    <div className="app-shell">
      <UsageTracker />
      <AppHeader hasDrawer={hasDrawer} onOpenDrawer={hasDrawer ? () => setDrawerOpen(true) : undefined} />
      <div className="app-body">
        <Outlet context={{drawerOpen, setDrawerOpen} satisfies AppLayoutOutletContext} />
      </div>
      <AppFooter />
    </div>
  )
}
