import {describe, expect, it, beforeEach, afterEach, vi} from 'vitest'
import {routes} from '@/app/routes'
import {ApiError} from '@/shared/api/apiError'
import {redirectIfUnauthorized} from '@/features/auth/lib/redirectIfUnauthorized'
import {CSRF_TOKEN_STORAGE_KEY} from '@/shared/auth/storage'

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
    localStorage.setItem(CSRF_TOKEN_STORAGE_KEY, 'stale-token')

    redirectIfUnauthorized(new ApiError(401, 'Not authenticated'))

    expect(localStorage.getItem(CSRF_TOKEN_STORAGE_KEY)).toBeNull()
    expect(window.location.href).toBe(routes.login)
  })

  it('ignores non-auth errors', () => {
    localStorage.setItem(CSRF_TOKEN_STORAGE_KEY, 'keep-token')

    redirectIfUnauthorized(new ApiError(409, 'Conflict'))

    expect(localStorage.getItem(CSRF_TOKEN_STORAGE_KEY)).toBe('keep-token')
    expect(window.location.href).toBe('/smart-review')
  })
})
