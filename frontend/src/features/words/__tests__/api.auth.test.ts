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
    vi.restoreAllMocks()
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

  it('uses a ZIP filename when the response filename header is not exposed', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('zip', {headers: {'Content-Type': 'application/zip'}}))
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = vi.fn(() => 'blob:test')
      static revokeObjectURL = vi.fn()
    })
    await exportWordsWorkbook(false, {languages: ['en', 'es']})
    expect((clicked.mock.instances[0] as HTMLAnchorElement).download).toBe('lexora-vocabulary-languages.zip')
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('languages=en&languages=es')
  })
})
