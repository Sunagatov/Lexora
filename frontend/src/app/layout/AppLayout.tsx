import {Outlet, useLocation} from 'react-router-dom'
import {useEffect, useState} from 'react'
import {AppHeader} from '@/app/layout/AppHeader'
import {AppFooter} from '@/app/layout/AppFooter'
import {UsageTracker} from '@/features/stats/components/UsageTracker'
import {QuickAddSheet} from '@/features/words/components/QuickAddSheet'
import {routes} from '@/app/routes'
import {LanguageRouteContext} from '@/features/languages/LanguageRouteContext'
import {PreferencesEffects} from '@/features/preferences/PreferencesEffects'
import {usePreferences} from '@/features/preferences/api'

export type AppLayoutOutletContext = {
  drawerOpen: boolean
  setDrawerOpen: (open: boolean) => void
}

function isStudyRoute(pathname: string) {
  return pathname === routes.home || pathname === routes.favorites || pathname === routes.smartReview || pathname.startsWith('/topics/')
}

export function AppLayout() {
  const location = useLocation()
  const preferences = usePreferences()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const hasDrawer = isStudyRoute(location.pathname)
  const canAddWord = location.pathname === routes.home || location.pathname === routes.allWords || location.pathname === routes.favorites || location.pathname.startsWith('/topics/')

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname, location.key])

  return (
    <div className="app-shell" data-hide-translations={!preferences.translations || undefined} data-hide-badges={!preferences.badges || undefined}
      data-hide-progress={!preferences.summary || undefined} data-neutral-knowledge={!preferences.colours || undefined} data-reduced-motion={!preferences.animations || undefined}>
      <PreferencesEffects />
      <LanguageRouteContext />
      <UsageTracker />
      <AppHeader hasDrawer={hasDrawer} drawerOpen={drawerOpen}
        onOpenDrawer={hasDrawer ? () => setDrawerOpen(open => !open) : undefined} />
      <div className="app-body">
        <div key={location.pathname} className="page-enter">
          <Outlet context={{drawerOpen, setDrawerOpen} satisfies AppLayoutOutletContext} />
        </div>
      </div>
      <AppFooter />

      <button
        type="button"
        className={`fab ${!canAddWord || drawerOpen ? 'fab-hidden' : ''}`}
        aria-label="Add word"
        onClick={() => setQuickAddOpen(true)}
      >
        <span className="fab-tooltip">Add word</span>
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="11" y1="3" x2="11" y2="19" />
          <line x1="3" y1="11" x2="19" y2="11" />
        </svg>
      </button>

      {quickAddOpen && <QuickAddSheet onClose={() => setQuickAddOpen(false)} />}
    </div>
  )
}
