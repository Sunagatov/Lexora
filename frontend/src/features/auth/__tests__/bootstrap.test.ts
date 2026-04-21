import {describe, it, expect, beforeEach, vi} from 'vitest'
import {bootstrapSession} from '../api'
import * as http from '../../../shared/http'

vi.mock('../../../shared/http')

describe('bootstrapSession', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('stores csrf_token in localStorage on success', async () => {
    const mockToken = 'csrf_token_from_session'
    vi.mocked(http.request).mockResolvedValueOnce({
      authenticated: true,
      csrf_token: mockToken,
    })

    const result = await bootstrapSession()

    expect(result).toBe(true)
    expect(localStorage.getItem('csrf_token')).toBe(mockToken)
  })

  it('returns false on error', async () => {
    vi.mocked(http.request).mockRejectedValueOnce(new Error('Network error'))

    const result = await bootstrapSession()

    expect(result).toBe(false)
    expect(localStorage.getItem('csrf_token')).toBeNull()
  })

  it('calls /auth/session endpoint', async () => {
    vi.mocked(http.request).mockResolvedValueOnce({
      authenticated: true,
      csrf_token: 'token',
    })

    await bootstrapSession()

    expect(http.request).toHaveBeenCalledWith('/auth/session')
  })
})
