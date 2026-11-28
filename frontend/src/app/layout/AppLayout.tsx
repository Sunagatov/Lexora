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
import {useIsMobile} from '@/shared/hooks/useIsMobile'
import {isIOSApp} from '@/shared/platform'

export type AppLayoutOutletContext = {
  drawerOpen: boolean
  setDrawerOpen: (open: boolean) => void
  collectionHeadingSlot?: {target: HTMLElement; showProgress: boolean}
}

function isStudyRoute(pathname: string) {
  return pathname === routes.home || pathname === routes.favorites || pathname === routes.smartReview || pathname.startsWith('/topics/')
}

export function AppLayout() {
  const location = useLocation()
  const preferences = usePreferences()
  const mobile = useIsMobile()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [collectionHeadingTarget, setCollectionHeadingTarget] = useState<HTMLDivElement | null>(null)
  const compactLibraryHeader = mobile && (location.pathname === routes.home || location.pathname === routes.favorites)
  const collectionHeadingSlot = compactLibraryHeader && collectionHeadingTarget
    ? {target: collectionHeadingTarget, showProgress: preferences.summary && !drawerOpen}
    : undefined
  const hasDrawer = isStudyRoute(location.pathname) || location.pathname === routes.account || location.pathname.startsWith(`${routes.account}/`)
  const canAddWord = location.pathname === routes.home || location.pathname === routes.allWords || location.pathname === routes.favorites || location.pathname.startsWith('/topics/')
  const showAddWord = canAddWord && !drawerOpen
  const addWordInHeader = mobile && !isIOSApp

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname, location.key])

  return (
    <div className="app-shell" data-hide-translations={!preferences.translations || undefined} data-hide-badges={!preferences.badges || undefined}
      data-hide-progress={!preferences.summary || undefined} data-neutral-knowledge={!preferences.colours || undefined} data-reduced-motion={!preferences.animations || undefined}
      data-ios={isIOSApp || undefined}>
      <PreferencesEffects />
      <LanguageRouteContext />
      <UsageTracker />
      <AppHeader hasDrawer={hasDrawer} drawerOpen={drawerOpen}
        onOpenDrawer={hasDrawer ? () => setDrawerOpen(open => !open) : undefined}
        onAddWord={addWordInHeader && showAddWord ? () => setQuickAddOpen(true) : undefined}
        collectionHeadingRef={compactLibraryHeader ? setCollectionHeadingTarget : undefined} />
      <div className="app-body">
        <div key={location.pathname} className="page-enter">
          <Outlet context={{drawerOpen, setDrawerOpen, collectionHeadingSlot} satisfies AppLayoutOutletContext} />
        </div>
      </div>
      <AppFooter />

      {!addWordInHeader && showAddWord && (
        <button type="button" className={mobile ? 'fab fab-mobile' : 'fab'} aria-label="Add word" onClick={() => setQuickAddOpen(true)}>
          <span className="fab-tooltip">Add word</span>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M11 3v16M3 11h16" />
          </svg>
        </button>
      )}

      {quickAddOpen && <QuickAddSheet onClose={() => setQuickAddOpen(false)} />}
    </div>
  )
}
