import { useEffect, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import { useIsMutating } from '@tanstack/react-query'
import { offlineStatus, subscribeOffline } from '@/features/offline/offline'
import { usePreferences, loadPreferences, preferencesSnapshot } from './api'

const isOffline = () => offlineStatus().offline

export function PreferencesEffects() {
  const preferences = usePreferences()
  const location = useLocation()
  const pending = useIsMutating() > 0
  const offline = useSyncExternalStore(subscribeOffline, isOffline)
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () =>
      document.documentElement.setAttribute(
        'color-scheme',
        preferences.theme === 'system' ? (media.matches ? 'dark' : 'light') : preferences.theme,
      )
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [preferences.theme])
  useEffect(() => {
    const refresh = () => {
      // A remote language change must not discard an open editor or active save.
      if (pending || location.pathname.endsWith('/edit') || document.querySelector('[role="dialog"], dialog[open]')) return
      void loadPreferences()
    }
    // Server recovery can happen without a browser online event.
    if (!offline && preferencesSnapshot().status === 'error') refresh()
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('online', refresh)
    }
  }, [offline, pending, location.pathname])
  return null
}
