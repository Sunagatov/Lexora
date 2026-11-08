import {expect, it, vi} from 'vitest'
import {waitFor} from '@testing-library/react'
import type {Preferences} from './api'

const network = vi.hoisted(() => vi.fn())
vi.mock('@/shared/api/http', () => ({networkRequest: network}))
vi.mock('@/features/auth/lib/redirectIfUnauthorized', () => ({redirectIfUnauthorized: vi.fn()}))

type Patch = Parameters<typeof import('./api').updatePreferences>[0]
const storageKey = 'lexora-owner-preferences-v1'
const cases: {name: string; first: Patch; second: Patch; expected: Partial<Preferences>}[] = [
  {name: 'different settings', first: {page_size: 200}, second: {swipes: false}, expected: {page_size: 200, swipes: false}},
  {name: 'the newest value of the same setting', first: {page_size: 200}, second: {page_size: 100}, expected: {page_size: 100}},
  {name: 'nested mix settings', first: {word_mix: {size: 75}}, second: {word_mix: {cefr_levels: ['A1']}}, expected: {word_mix: {size: 75, levels: [1], cefr_levels: ['A1'], cooldown_days: 1, balance_topics: true}}},
  {name: 'pronunciation settings for both languages', first: {pronunciation_modes: {zh: 'pinyin'}}, second: {pronunciation_modes: {es: 'ipa'}}, expected: {pronunciation_modes: {zh: 'pinyin', es: 'ipa'}}},
]

it.each(cases)('recovers $name after reloading with an unacknowledged request', async ({first, second, expected}) => {
  localStorage.clear()
  vi.resetModules()
  network.mockReset().mockImplementationOnce(() => new Promise(() => {}))
  const original = await import('./api')
  original.updatePreferences(first)
  original.updatePreferences(second)

  // Reload from the durable copy while the first request has never reached the server.
  const durable = localStorage.getItem(storageKey)!
  vi.resetModules()
  localStorage.setItem(storageKey, durable)
  const reloaded = await import('./api')
  let server = {...reloaded.DEFAULT_PREFERENCES}
  network.mockImplementation(async (_path: string, init?: RequestInit) => {
    const patch = JSON.parse(String(init?.body)) as Patch
    server = {...server, ...patch,
      word_mix: {...server.word_mix, ...patch.word_mix},
      pronunciation_modes: {...server.pronunciation_modes, ...patch.pronunciation_modes}}
    return server
  })
  await reloaded.loadPreferences()
  expect(server).toMatchObject(expected)
  expect(reloaded.preferencesSnapshot().values).toMatchObject(expected)
  expect(JSON.parse(localStorage.getItem(storageKey)!).pending).toEqual({})
})

it('removes only acknowledged edits from the durable recovery record', async () => {
  localStorage.clear()
  vi.resetModules()
  let finishFirst!: (value: Preferences) => void
  let finishSecond!: (value: Preferences) => void
  network.mockReset()
    .mockImplementationOnce(() => new Promise(resolve => {finishFirst = resolve}))
    .mockImplementationOnce(() => new Promise(resolve => {finishSecond = resolve}))
  const api = await import('./api')
  api.updatePreferences({page_size: 200})
  api.updatePreferences({swipes: false})
  expect(JSON.parse(localStorage.getItem(storageKey)!).pending).toEqual({page_size: 200, swipes: false})
  finishFirst({...api.DEFAULT_PREFERENCES, page_size: 200})
  await waitFor(() => expect(network).toHaveBeenCalledTimes(2))
  expect(JSON.parse(localStorage.getItem(storageKey)!).pending).toEqual({swipes: false})
  finishSecond({...api.DEFAULT_PREFERENCES, page_size: 200, swipes: false})
  await waitFor(() => expect(api.preferencesSnapshot().status).toBe('saved'))
  expect(JSON.parse(localStorage.getItem(storageKey)!).pending).toEqual({})
})
