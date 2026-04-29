import {render} from '@testing-library/react'
import {MemoryRouter} from 'react-router-dom'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {ApiError} from '../../../shared/apiError'
import {UsageTracker} from '../UsageTracker'
import * as statsApi from '../api'
import * as authRedirect from '../../auth/redirectIfUnauthorized'

vi.mock('../api')
vi.mock('../../auth/redirectIfUnauthorized')

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

describe('UsageTracker auth handling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('localStorage', makeStorage())
    vi.stubGlobal('sessionStorage', makeStorage())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('redirects unauthorized background usage submissions', async () => {
    vi.mocked(statsApi.recordUsageEvent).mockRejectedValue(new ApiError(401, 'Not authenticated'))

    render(
      <MemoryRouter initialEntries={['/smart-review']}>
        <UsageTracker />
      </MemoryRouter>,
    )

    await vi.advanceTimersByTimeAsync(15_000)
    await Promise.resolve()

    expect(statsApi.recordUsageEvent).toHaveBeenCalled()
    expect(authRedirect.redirectIfUnauthorized).toHaveBeenCalledWith(expect.any(ApiError))
  })

  it('flushes partial active time on pagehide instead of dropping sub-threshold seconds', async () => {
    vi.mocked(statsApi.recordUsageEvent).mockResolvedValue(undefined)

    render(
      <MemoryRouter initialEntries={['/smart-review']}>
        <UsageTracker />
      </MemoryRouter>,
    )

    await vi.advanceTimersByTimeAsync(8_000)
    window.dispatchEvent(new Event('pagehide'))
    await Promise.resolve()

    expect(statsApi.recordUsageEvent).toHaveBeenCalledWith(
      expect.objectContaining({active_seconds: 8}),
    )
  })
})
