import {act, render} from '@testing-library/react'
import {MemoryRouter} from 'react-router-dom'
import {afterEach, expect, it, vi} from 'vitest'
import {UsageTracker} from '../components/UsageTracker'
import {recordUsageEvent} from '../api/statsApi'

vi.mock('../api/statsApi', () => ({recordUsageEvent: vi.fn()}))
vi.mock('@/features/auth/lib/redirectIfUnauthorized', () => ({redirectIfUnauthorized: vi.fn()}))

afterEach(() => {vi.useRealTimers()})

it.each(['pagehide', 'visibilitychange'])('records all eight foreground seconds on %s', async event => {
  vi.useFakeTimers()
  vi.mocked(recordUsageEvent).mockReset().mockResolvedValue(undefined)
  let visibility = 'visible'
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility as DocumentVisibilityState)
  render(<MemoryRouter><UsageTracker /></MemoryRouter>)
  await act(async () => {await vi.advanceTimersByTimeAsync(8000)})
  await act(async () => {
    visibility = 'hidden'
    if (event === 'pagehide') window.dispatchEvent(new Event(event))
    else document.dispatchEvent(new Event(event))
  })
  const seconds = vi.mocked(recordUsageEvent).mock.calls.reduce((total, [payload]) => total + payload.active_seconds, 0)
  expect(seconds).toBe(8)
})
