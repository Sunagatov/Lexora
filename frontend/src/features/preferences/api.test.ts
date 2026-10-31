import { beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { networkRequest } from '@/shared/api/http'
import {
  DEFAULT_PREFERENCES,
  flushPreferences,
  loadPreferences,
  preferencesSnapshot,
  updatePreferences,
  type Preferences,
} from './api'

vi.mock('@/shared/api/http', () => ({ networkRequest: vi.fn() }))

describe('owner preferences sync', () => {
  beforeEach(async () => {
    vi.mocked(networkRequest).mockReset()
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
})
