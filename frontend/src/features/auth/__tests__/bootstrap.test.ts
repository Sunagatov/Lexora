import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {bootstrapSession, logout} from '@/features/auth/api/authApi'
import * as http from '@/shared/api/http'
import {ApiError} from '@/shared/api/apiError'
import {CSRF_TOKEN_STORAGE_KEY} from '@/shared/auth/storage'

vi.mock('@/shared/api/http')

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

describe('bootstrapSession', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeStorage())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('stores csrf token in localStorage on success', async () => {
    const mockToken = 'csrf_token_from_session'
    vi.mocked(http.request).mockResolvedValueOnce({
      authenticated: true,
      csrf_token: mockToken,
    })

    const result = await bootstrapSession()

    expect(result).toBe(true)
    expect(localStorage.getItem(CSRF_TOKEN_STORAGE_KEY)).toBe(mockToken)
  })

  it('returns false and clears csrf token when the backend rejects the session', async () => {
    localStorage.setItem(CSRF_TOKEN_STORAGE_KEY, 'stale-token')
    vi.mocked(http.request).mockRejectedValueOnce(new ApiError(401, 'Not authenticated'))

    const result = await bootstrapSession()

    expect(result).toBe(false)
    expect(localStorage.getItem(CSRF_TOKEN_STORAGE_KEY)).toBeNull()
  })

  it('clears the existing csrf token on transient bootstrap errors', async () => {
    localStorage.setItem(CSRF_TOKEN_STORAGE_KEY, 'stale-token')
    vi.mocked(http.request).mockRejectedValueOnce(new Error('Network error'))

    const result = await bootstrapSession()

    expect(result).toBe(false)
    expect(localStorage.getItem(CSRF_TOKEN_STORAGE_KEY)).toBeNull()
  })

  it('returns false on transient bootstrap errors when there is no existing csrf token', async () => {
    vi.mocked(http.request).mockRejectedValueOnce(new Error('Network error'))

    const result = await bootstrapSession()

    expect(result).toBe(false)
    expect(localStorage.getItem(CSRF_TOKEN_STORAGE_KEY)).toBeNull()
  })

  it('calls /auth/session endpoint', async () => {
    vi.mocked(http.request).mockResolvedValueOnce({
      authenticated: true,
      csrf_token: 'token',
    })

    await bootstrapSession()

    expect(http.request).toHaveBeenCalledWith('/auth/session')
  })

  it('calls /auth/logout and clears csrf token', async () => {
    localStorage.setItem(CSRF_TOKEN_STORAGE_KEY, 'token')
    vi.mocked(http.request).mockResolvedValueOnce({ok: true})

    await logout()

    expect(http.request).toHaveBeenCalledWith('/auth/logout', {method: 'POST'})
    expect(localStorage.getItem(CSRF_TOKEN_STORAGE_KEY)).toBeNull()
  })
})
