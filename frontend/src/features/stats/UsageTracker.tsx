import {useCallback, useEffect, useRef} from 'react'
import {useLocation} from 'react-router-dom'
import {recordUsageEvent} from './api'
import {redirectIfUnauthorized} from '../auth/redirectIfUnauthorized'

const SESSION_STORAGE_KEY = 'lexora-usage-session-key'
const FLUSH_THRESHOLD_SECONDS = 15
const TICK_INTERVAL_MS = 5000
const IDLE_TIMEOUT_MS = 60_000
const ROTATE_AFTER_GAP_MS = 30 * 60_000

type PendingUsageEvent = {
  eventKey: string
  sessionKey: string
  route: string
  activeSeconds: number
}

function newKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `usage_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function getSessionKey(): string {
  const stored = sessionStorage.getItem(SESSION_STORAGE_KEY)
  if (stored) return stored
  const sessionKey = newKey()
  sessionStorage.setItem(SESSION_STORAGE_KEY, sessionKey)
  return sessionKey
}

export function UsageTracker() {
  const {pathname} = useLocation()
  const sessionKeyRef = useRef<string>(getSessionKey())
  const routeRef = useRef(pathname)
  const lastActivityAtRef = useRef(Date.now())
  const lastTickAtRef = useRef(Date.now())
  const pendingSecondsRef = useRef(0)
  const pendingEventRef = useRef<PendingUsageEvent | null>(null)
  const visibleRef = useRef(typeof document === 'undefined' ? false : document.visibilityState === 'visible')

  const accrueActiveTime = useCallback((now = Date.now()) => {
    if (!visibleRef.current) {
      lastTickAtRef.current = now
      return
    }
    if (now - lastActivityAtRef.current > IDLE_TIMEOUT_MS) {
      lastTickAtRef.current = now
      return
    }

    const elapsedMs = Math.max(0, now - lastTickAtRef.current)
    if (elapsedMs <= 0) return

    pendingSecondsRef.current += elapsedMs / 1000
    lastTickAtRef.current = now
  }, [])

  const flushPending = useCallback(async (now = Date.now()) => {
    accrueActiveTime(now)

    if (pendingEventRef.current === null) {
      const seconds = Math.floor(pendingSecondsRef.current)
      if (seconds <= 0) return
      pendingSecondsRef.current -= seconds
      pendingEventRef.current = {
        eventKey: newKey(),
        sessionKey: sessionKeyRef.current,
        route: routeRef.current,
        activeSeconds: seconds,
      }
    }

    const event = pendingEventRef.current
    if (!event) return

    try {
      await recordUsageEvent({
        event_key: event.eventKey,
        session_key: event.sessionKey,
        route: event.route,
        active_seconds: event.activeSeconds,
      })
      pendingEventRef.current = null
    } catch (error) {
      redirectIfUnauthorized(error)
      // Keep the pending payload for the next flush attempt.
    }
  }, [accrueActiveTime])

  useEffect(() => {
    void flushPending()
    routeRef.current = pathname
  }, [flushPending, pathname])

  useEffect(() => {
    function markActivity() {
      const now = Date.now()
      if (now - lastActivityAtRef.current > ROTATE_AFTER_GAP_MS) {
        void flushPending(now)
        sessionKeyRef.current = newKey()
        sessionStorage.setItem(SESSION_STORAGE_KEY, sessionKeyRef.current)
        pendingEventRef.current = null
        pendingSecondsRef.current = 0
      }
      lastActivityAtRef.current = now
      visibleRef.current = document.visibilityState === 'visible'
    }

    function handleVisibilityChange() {
      const now = Date.now()
      if (document.visibilityState === 'visible') {
        if (now - lastActivityAtRef.current > ROTATE_AFTER_GAP_MS) {
          void flushPending(now)
          sessionKeyRef.current = newKey()
          sessionStorage.setItem(SESSION_STORAGE_KEY, sessionKeyRef.current)
          pendingEventRef.current = null
          pendingSecondsRef.current = 0
        }
        lastActivityAtRef.current = now
        lastTickAtRef.current = now
        visibleRef.current = true
        return
      }

      visibleRef.current = false
      void flushPending(now)
    }

    function handlePageHide() {
      void flushPending(Date.now())
    }

    const activityEvents = ['pointerdown', 'keydown', 'touchstart', 'scroll', 'mousemove'] as const
    activityEvents.forEach((eventName) => window.addEventListener(eventName, markActivity, {passive: true}))
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)

    const intervalId = window.setInterval(() => {
      const now = Date.now()
      accrueActiveTime(now)

      if (pendingSecondsRef.current >= FLUSH_THRESHOLD_SECONDS) {
        void flushPending(now)
      }
    }, TICK_INTERVAL_MS)

    return () => {
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, markActivity))
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
      window.clearInterval(intervalId)
      void flushPending(Date.now())
    }
  }, [accrueActiveTime, flushPending])

  return null
}
