import { beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { networkRequest } from '@/shared/api/http'
import { ApiError } from '@/shared/api/apiError'
import { redirectIfUnauthorized } from '@/features/auth/lib/redirectIfUnauthorized'
import {
  DEFAULT_PREFERENCES,
  flushPreferences,
  loadPreferences,
  preferencesSnapshot,
  updatePreferences,
  type Preferences,
} from './api'

vi.mock('@/shared/api/http', () => ({ networkRequest: vi.fn() }))
vi.mock('@/features/auth/lib/redirectIfUnauthorized', () => ({redirectIfUnauthorized: vi.fn()}))

describe('owner preferences sync', () => {
  beforeEach(async () => {
    vi.mocked(networkRequest).mockReset()
    vi.mocked(redirectIfUnauthorized).mockClear()
    vi.mocked(networkRequest).mockResolvedValue({ ...DEFAULT_PREFERENCES })
    await flushPreferences()
    await loadPreferences()
  })

  it('keeps rapid changes visible while saving only changed fields in order', async () => {
    let completeFirst!: (value: Preferences) => void
    vi.mocked(networkRequest)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            completeFirst = resolve as typeof completeFirst
          }),
      )
      .mockResolvedValueOnce({ ...DEFAULT_PREFERENCES, swipes: false, pronunciation: false })
    updatePreferences({ swipes: false })
    updatePreferences({ pronunciation: false })
    expect(preferencesSnapshot().values.swipes).toBe(false)
    expect(preferencesSnapshot().values.pronunciation).toBe(false)
    completeFirst({ ...DEFAULT_PREFERENCES, swipes: false })
    await waitFor(() => expect(preferencesSnapshot().status).toBe('saved'))
    expect(preferencesSnapshot().values.pronunciation).toBe(false)
    const patches = vi
      .mocked(networkRequest)
      .mock.calls.filter(([, init]) => init?.method === 'PATCH')
    expect(patches.map(([, init]) => JSON.parse(String(init?.body)))).toEqual([
      { swipes: false },
      { pronunciation: false },
    ])
  })

  it('retains a failed change for retry instead of claiming it synced', async () => {
    vi.mocked(networkRequest).mockRejectedValueOnce(new TypeError('Network unavailable'))
    updatePreferences({ page_size: 200 })
    await waitFor(() => expect(preferencesSnapshot().status).toBe('error'))
    expect(preferencesSnapshot().values.page_size).toBe(200)
    vi.mocked(networkRequest).mockResolvedValue({ ...DEFAULT_PREFERENCES, page_size: 200 })
    await flushPreferences()
    expect(preferencesSnapshot().status).toBe('saved')
    expect(preferencesSnapshot().values.page_size).toBe(200)
  })

  it('sends only changed mix fields and keeps queued mix edits while a save is in flight', async () => {
    let completeFirst!: (value: Preferences) => void
    vi.mocked(networkRequest).mockImplementationOnce(() => new Promise(resolve => {completeFirst = resolve as typeof completeFirst}))
      .mockResolvedValueOnce({...DEFAULT_PREFERENCES, word_mix: {...DEFAULT_PREFERENCES.word_mix, size: 75, cefr_levels: ['A1']}})
    updatePreferences({word_mix: {size: 75}})
    updatePreferences({word_mix: {cefr_levels: ['A1']}})
    completeFirst({...DEFAULT_PREFERENCES, word_mix: {...DEFAULT_PREFERENCES.word_mix, size: 75}})
    await waitFor(() => expect(preferencesSnapshot().status).toBe('saved'))
    expect(preferencesSnapshot().values.word_mix).toMatchObject({size: 75, cefr_levels: ['A1']})
    const patches = vi.mocked(networkRequest).mock.calls.filter(([, init]) => init?.method === 'PATCH')
    expect(patches.map(([, init]) => JSON.parse(String(init?.body)))).toEqual([
      {word_mix: {size: 75}}, {word_mix: {cefr_levels: ['A1']}},
    ])
  })

  it('ignores a stale read even when a newer edit has finished saving', async () => {
    let completeRead!: (value: Preferences) => void
    vi.mocked(networkRequest)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            completeRead = resolve as typeof completeRead
          }),
      )
      .mockResolvedValueOnce({ ...DEFAULT_PREFERENCES, page_size: 100 })
    const reading = loadPreferences()
    updatePreferences({ page_size: 100 })
    await waitFor(() => expect(preferencesSnapshot().status).toBe('saved'))
    completeRead({ ...DEFAULT_PREFERENCES })
    await reading
    expect(preferencesSnapshot().values.page_size).toBe(100)
  })

  it('keeps the newest refresh when overlapping reads finish out of order', async () => {
    let finishOlder!: (value: Preferences) => void
    vi.mocked(networkRequest)
      .mockImplementationOnce(() => new Promise(resolve => { finishOlder = resolve as typeof finishOlder }))
      .mockResolvedValueOnce({ ...DEFAULT_PREFERENCES, page_size: 200 })
    const older = loadPreferences()
    await loadPreferences()
    finishOlder({ ...DEFAULT_PREFERENCES, page_size: 50 })
    await older
    expect(preferencesSnapshot().values.page_size).toBe(200)
  })

  it('reports a failed refresh and recovers on retry without changing cached settings', async () => {
    vi.mocked(networkRequest).mockRejectedValueOnce(new Error('Service unavailable'))
    await loadPreferences()
    expect(preferencesSnapshot().status).toBe('error')
    expect(preferencesSnapshot().error).toContain('load settings')
    expect(preferencesSnapshot().values.page_size).toBe(DEFAULT_PREFERENCES.page_size)
    vi.mocked(networkRequest).mockResolvedValueOnce({ ...DEFAULT_PREFERENCES, page_size: 100 })
    await loadPreferences()
    expect(preferencesSnapshot().status).toBe('saved')
    expect(preferencesSnapshot().values.page_size).toBe(100)
  })

  it('ignores a failed older refresh after a newer refresh succeeds', async () => {
    let failOlder!: (error: Error) => void
    vi.mocked(networkRequest)
      .mockImplementationOnce(() => new Promise((_, reject) => { failOlder = reject }))
      .mockResolvedValueOnce({ ...DEFAULT_PREFERENCES, page_size: 200 })
    const older = loadPreferences()
    await loadPreferences()
    failOlder(new Error('Old request timed out'))
    await older
    expect(preferencesSnapshot().status).toBe('saved')
    expect(preferencesSnapshot().values.page_size).toBe(200)
  })

  it('merges pronunciation choices without clearing another language', async () => {
    vi.mocked(networkRequest).mockResolvedValue({
      ...DEFAULT_PREFERENCES,
      pronunciation_modes: { zh: 'pinyin' },
    })
    updatePreferences({ pronunciation_modes: { zh: 'pinyin' } })
    await waitFor(() => expect(preferencesSnapshot().status).toBe('saved'))
    vi.mocked(networkRequest).mockResolvedValue({
      ...DEFAULT_PREFERENCES,
      pronunciation_modes: { zh: 'pinyin', es: 'ipa' },
    })
    updatePreferences({ pronunciation_modes: { es: 'ipa' } })
    await waitFor(() => expect(preferencesSnapshot().status).toBe('saved'))
    expect(preferencesSnapshot().values.pronunciation_modes).toEqual({ zh: 'pinyin', es: 'ipa' })
  })

  it.each([401, 403])('handles an expired session during settings refresh (%s)', async status => {
    const error = new ApiError(status, 'Not authenticated')
    vi.mocked(networkRequest).mockRejectedValueOnce(error)
    await loadPreferences()
    expect(redirectIfUnauthorized).toHaveBeenCalledWith(error)
  })

  it('handles an expired session during a settings save', async () => {
    const error = new ApiError(401, 'Not authenticated')
    vi.mocked(networkRequest).mockRejectedValueOnce(error)
    updatePreferences({theme: 'light'})
    await waitFor(() => expect(redirectIfUnauthorized).toHaveBeenCalledWith(error))
  })

  it('ignores an expired-session error from a superseded refresh', async () => {
    let failOlder!: (error: Error) => void
    vi.mocked(networkRequest)
      .mockImplementationOnce(() => new Promise((_, reject) => {failOlder = reject}))
      .mockResolvedValueOnce({...DEFAULT_PREFERENCES})
    const older = loadPreferences()
    await loadPreferences()
    failOlder(new ApiError(401, 'Not authenticated'))
    await older
    expect(redirectIfUnauthorized).not.toHaveBeenCalled()
  })
})
