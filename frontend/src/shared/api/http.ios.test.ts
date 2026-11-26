import {afterEach, expect, it, vi} from 'vitest'

vi.mock('@/shared/platform', () => ({isIOSApp: true}))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

it('sends packaged iOS API calls to Lexora with the existing session headers', async () => {
  vi.stubEnv('VITE_API_BASE_URL', '')
  const {buildApiUrl, networkRequest} = await import('./http')
  const fetch = vi.fn().mockResolvedValue(Response.json({ok: true}))
  vi.stubGlobal('fetch', fetch)
  const path = '/api/preferences'
  await expect(networkRequest(path, {headers: {'X-CSRF-Token': 'test-only'}})).resolves.toEqual({ok: true})
  expect(buildApiUrl(path)).toBe('https://lexora.zuf.uk/api/preferences')
  expect(fetch).toHaveBeenCalledWith(buildApiUrl(path), expect.objectContaining({credentials: 'include'}))
  expect(fetch.mock.calls[0][1].headers.get('X-CSRF-Token')).toBe('test-only')
})

it('classifies iOS connection failures the same way as the browser', async () => {
  const {networkRequest} = await import('./http')
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue({code: 'NSURLErrorDomain'}))
  await expect(networkRequest('/auth/session')).rejects.toBeInstanceOf(TypeError)
})
