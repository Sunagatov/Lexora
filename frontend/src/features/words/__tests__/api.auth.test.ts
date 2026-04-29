import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {ApiError} from '@/shared/api/apiError'
import {exportWordsWorkbook} from '@/features/words/api/wordsApi'

vi.mock('@/features/auth/lib/redirectIfUnauthorized', () => ({
  redirectIfUnauthorized: vi.fn(),
}))

import {redirectIfUnauthorized} from '@/features/auth/lib/redirectIfUnauthorized'

describe('words api auth handling', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('redirects unauthorized export failures before rethrowing', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({detail: 'Not authenticated'}), {
        status: 401,
        headers: {'Content-Type': 'application/json'},
      }),
    )

    await expect(exportWordsWorkbook()).rejects.toEqual(new ApiError(401, 'Not authenticated'))
    expect(redirectIfUnauthorized).toHaveBeenCalledWith(expect.objectContaining({status: 401}))
  })
})
