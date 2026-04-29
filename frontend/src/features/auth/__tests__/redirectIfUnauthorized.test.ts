import {describe, expect, it, beforeEach, afterEach, vi} from 'vitest'
import {routes} from '@/app/routes'
import {ApiError} from '@/shared/api/apiError'
import {redirectIfUnauthorized} from '@/features/auth/lib/redirectIfUnauthorized'

function makeStorage() {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.get(key) ?? null
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
    removeItem(key: string) {
      store.delete(key)
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
  } as Storage
}

describe('redirectIfUnauthorized', () => {
  const originalLocation = window.location

  beforeEach(() => {
    vi.stubGlobal('localStorage', makeStorage())
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {href: '/smart-review'},
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
    vi.unstubAllGlobals()
  })

  it('clears csrf token and redirects on unauthorized errors', () => {
    localStorage.setItem('csrf_token', 'stale-token')

    redirectIfUnauthorized(new ApiError(401, 'Not authenticated'))

    expect(localStorage.getItem('csrf_token')).toBeNull()
    expect(window.location.href).toBe(routes.login)
  })

  it('ignores non-auth errors', () => {
    localStorage.setItem('csrf_token', 'keep-token')

    redirectIfUnauthorized(new ApiError(409, 'Conflict'))

    expect(localStorage.getItem('csrf_token')).toBe('keep-token')
    expect(window.location.href).toBe('/smart-review')
  })
})
