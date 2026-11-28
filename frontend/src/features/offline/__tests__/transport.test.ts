import type {Replica} from '../types'
import type {StudyQueue} from '@/features/smart-review/types/studyQueueTypes'
import {act, render, waitFor} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {createElement} from 'react'
import {createMemoryRouter, RouterProvider} from 'react-router-dom'

const fake = vi.hoisted(() => ({
  replica: undefined as Replica | undefined,
  ios: false,
  adapter: undefined as undefined | ((path: string, init: RequestInit, network: (path: string, init: RequestInit) => Promise<unknown>) => Promise<unknown>),
  network: vi.fn(), read: vi.fn(), write: vi.fn(), writeMix: vi.fn(), writeSync: vi.fn(), lock: Promise.resolve() as Promise<unknown>,
}))
vi.mock('@/shared/api/http', () => ({networkRequest: fake.network, setRequestAdapter: (adapter: typeof fake.adapter) => { fake.adapter = adapter }}))
vi.mock('@/shared/platform', () => ({get isIOSApp() { return fake.ios }}))
vi.mock('../storage', async importOriginal => ({
  ...await importOriginal<typeof import('../storage')>(),
  readReplica: async () => { fake.read(); return structuredClone(fake.replica) },
  initializeMixProgress: async () => {},
  deleteOfflineValue: async () => {},
  readOfflineValue: async () => undefined,
  readRecallUploadState: async () => ({attempts: [], paused: false, hasReplica: !!fake.replica}),
  mutateOfflineValue: async () => {},
  writeReplica: async (replica: Replica) => { fake.write(); fake.replica = structuredClone(replica) },
  writeSyncState: async ({changes, cursor, forceWordIds, forceTopicIds, revisions, revision, savedAt, public_config, blockedChanges, refreshPending}: Replica) => {
    fake.writeSync()
    Object.assign(fake.replica!, structuredClone({changes, cursor, forceWordIds, forceTopicIds, revisions, revision,
      savedAt, public_config, blockedChanges, refreshPending}))
  },
  writeMixState: async ({mixes, mixReviewedAt, nextId}: Replica) => {
    fake.writeMix()
    Object.assign(fake.replica!, structuredClone({mixes, mixReviewedAt, nextId}))
  },
  withOfflineLock: (work: () => Promise<unknown>, name?: string) => {
    if (name === 'lexora-offline-sync') return work()
    const result = fake.lock.then(work)
    fake.lock = result.catch(() => {})
    return result
  },
}))

async function setup(online = false) {
  vi.resetModules()
  vi.stubGlobal('indexedDB', {})
  vi.stubGlobal('BroadcastChannel', class { onmessage = null; postMessage() {} })
  vi.spyOn(window, 'setInterval').mockReturnValue(1)
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online)
  fake.network.mockReset(); fake.read.mockClear(); fake.write.mockClear(); fake.writeMix.mockClear(); fake.writeSync.mockClear(); fake.lock = Promise.resolve()
  fake.replica = {version: 1, words: [], topics: [], changes: [], nextId: -1, savedAt: new Date().toISOString()}
  const {changeItem} = await import('../changes')
  changeItem(fake.replica, 'topic', 'create', -1, {name: 'People'})
  changeItem(fake.replica, 'word', 'create', -1, {term: 'patient', topic_ids: [-1], knowledge_level: 1})
  fake.replica.changes = []
  const offline = await import('../offline')
  const refresh = vi.fn()
  await offline.initializeOffline(refresh)
  const request = (path: string, init: RequestInit = {}) => fake.adapter!(path, init, fake.network)
  return {offline, refresh, request}
}

afterEach(() => {
  fake.ios = false
  Reflect.deleteProperty(navigator, 'serviceWorker')
  Reflect.deleteProperty(navigator, 'locks')
  localStorage.removeItem('lexora-offline-logout')
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('saves the library in the packaged iOS app without a service worker', async () => {
  fake.ios = true
  Object.defineProperty(navigator, 'locks', {configurable: true, value: {}})
  const {offline} = await setup()
  fake.network.mockResolvedValueOnce(structuredClone(fake.replica!)).mockResolvedValueOnce(undefined)
  await offline.saveOffline()
  expect(offline.offlineStatus()).toMatchObject({saved: true, words: 1})
  expect(fake.network.mock.calls.map(([path]) => path)).toEqual(['/api/offline/snapshot?include_revisions=true&include_cursor=true', '/api/smart-review'])
})

it('opens a saved iOS library immediately when the phone is offline', async () => {
  fake.ios = true
  Object.defineProperty(navigator, 'locks', {configurable: true, value: {}})
  const {request} = await setup()
  await expect(request('/auth/session')).resolves.toEqual({authenticated: true, csrf_token: ''})
  expect(fake.network).not.toHaveBeenCalled()
})

it('keeps online-only statistics and usage requests out of saved-library storage', async () => {
  const {request} = await setup(true)
  fake.read.mockClear()
  fake.network.mockResolvedValue({ok: true})
  await expect(request('/api/stats/learning')).resolves.toEqual({ok: true})
  await expect(request('/api/stats/library/entries?gap=translation')).resolves.toEqual({ok: true})
  await expect(request('/api/stats/usage', {method: 'POST', body: '{}'})).resolves.toEqual({ok: true})
  expect(fake.read).not.toHaveBeenCalled()
})

it('merges changed records and purges while keeping the authoritative revision inventory', async () => {
  const {offline} = await setup()
  const latest = fake.replica!
  latest.words[0] = {...latest.words[0], id: 21, topic_ids: [5]}
  latest.topics[0] = {...latest.topics[0], id: 5}
  latest.revisions = {version: 1, word_hashes: {'21': 'old', '22': 'removed'}, topic_hashes: {'5': 'retained'}}
  latest.words.push({...latest.words[0], id: 22, term: 'removed'})
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  fake.network.mockImplementation(async (path: string, init: RequestInit) => {
    if (path === '/auth/session') return {csrf_token: 'test-only'}
    if (path === '/api/offline/delta?include_cursor=true') {
      expect(JSON.parse(String(init.body))).toEqual(latest.revisions)
      return {version: 1, words: [{...latest.words[0], term: 'updated'}], topics: [],
        removed_word_ids: [22], removed_topic_ids: [],
        revisions: {version: 1, word_hashes: {'21': 'new'}, topic_hashes: {}}}
    }
    throw Error(`Unexpected request ${path}`)
  })
  await offline.syncOffline(true)
  expect(fake.replica?.words.map(({id, term}) => [id, term])).toEqual([[21, 'updated']])
  expect(fake.replica?.topics.map(topic => topic.id)).toEqual([5])
  expect(fake.replica?.revisions).toEqual({version: 1, word_hashes: {'21': 'new'}, topic_hashes: {'5': 'retained'}})
  expect(fake.network.mock.calls.map(([path]) => path)).toEqual(['/auth/session', '/api/offline/delta?include_cursor=true'])
})

it('uses the catalog cursor and requests the canonical word after an accepted edit', async () => {
  const {request, offline} = await setup()
  const {remapId} = await import('../changes')
  remapId(fake.replica!, 'word', -2, 21)
  const cursor = {version: 1 as const, epoch: 'a'.repeat(32), revision: '11'}
  fake.replica!.cursor = cursor
  fake.replica!.words.push({...fake.replica!.words[0], id: 22})
  await request('/api/words/21', {method: 'PUT', body: JSON.stringify({knowledge_level: 4})})
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  fake.network.mockImplementation(async (path: string, init: RequestInit) => {
    if (path === '/auth/session') return {csrf_token: 'test-only'}
    if (path === '/api/offline/changes') return {entity_id: 21}
    expect(path).toBe('/api/offline/cursor')
    expect(JSON.parse(String(init.body))).toEqual({cursor, force_word_ids: [21], force_topic_ids: []})
    return {version: 1, cursor: {...cursor, revision: '12'},
      words: [{...fake.replica!.words[0], term: 'canonical'}], topics: [],
      removed_word_ids: [22], removed_topic_ids: []}
  })

  await offline.syncOffline(true)
  expect(fake.replica!.words).toMatchObject([{id: 21, term: 'canonical', knowledge_level: 4}])
  expect(fake.replica!.cursor?.revision).toBe('12')
  expect(fake.replica!.forceWordIds).toBeUndefined()
  expect(fake.network.mock.calls.map(([path]) => path)).toEqual(['/auth/session', '/api/offline/changes', '/api/offline/cursor'])
})

it('uploads independent words in one request and keeps a rejected word without blocking the rest', async () => {
  const {request, offline} = await setup()
  const {remapId} = await import('../changes')
  remapId(fake.replica!, 'topic', -1, 1)
  remapId(fake.replica!, 'word', -2, 21)
  fake.replica!.words.push({...fake.replica!.words[0], id: 22, term: 'unrelated'})
  for (const id of [21, 22]) await request(`/api/words/${id}`, {method: 'PUT', body: JSON.stringify({knowledge_level: 4})})
  const [rejected, valid] = fake.replica!.changes
  fake.write.mockClear()
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  fake.network.mockImplementation(async (path: string, init: RequestInit) => {
    if (path === '/auth/session') return {csrf_token: 'test-only'}
    expect(path).toBe('/api/offline/changes/batch')
    expect(JSON.parse(String(init.body)).changes.map((edit: {id: string}) => edit.id)).toEqual([rejected.id, valid.id])
    return {results: [
      {change_id: rejected.id, status: 409, detail: 'This word no longer exists'},
      {change_id: valid.id, status: 200, result: {entity_id: 22}},
    ]}
  })
  await offline.syncOffline(true)
  expect(fake.replica!.changes.map(edit => edit.id)).toEqual([rejected.id])
  expect(offline.offlineStatus()).toMatchObject({pending: 1, issues: [{changeId: rejected.id, message: 'This word no longer exists'}]})
  expect(fake.write).not.toHaveBeenCalled()
  expect(fake.writeSync).toHaveBeenCalledTimes(1)
})

it('shows the chosen server value immediately if downloading the catalog fails', async () => {
  const {request, offline} = await setup()
  const {remapId} = await import('../changes')
  const {ApiError} = await import('@/shared/api/apiError')
  remapId(fake.replica!, 'topic', -1, 1)
  remapId(fake.replica!, 'word', -2, 21)
  const serverWord = {...fake.replica!.words[0], knowledge_level: 3}
  await request('/api/words/21', {method: 'PUT', body: JSON.stringify({knowledge_level: 4})})
  const edit = fake.replica!.changes[0]
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  fake.network.mockImplementation(async (path: string) => {
    if (path === '/auth/session') return {csrf_token: 'test-only'}
    if (path === '/api/offline/changes') throw new ApiError(409, 'Conflict', {
      code: 'offline_edit_conflict', change_id: edit.id, server_item: serverWord,
      fields: [{field: 'knowledge_level', before: 1, device: 4, server: 3}],
    })
    throw new TypeError('Connection interrupted during download')
  })
  await offline.syncOffline(true)
  await offline.resolveOfflineConflict('server')
  expect(offline.offlineStatus()).toMatchObject({pending: 0, conflict: undefined, offline: true, refreshPending: true})
  await expect(request('/api/words/21')).resolves.toMatchObject({knowledge_level: 3})
})

it.each(['server', 'device'] as const)('resolves a queued conflict using the %s version and keeps later edits', async choice => {
  const {request, offline} = await setup()
  const {remapId} = await import('../changes')
  const {ApiError} = await import('@/shared/api/apiError')
  remapId(fake.replica!, 'word', -2, 21)
  const serverWord = {...fake.replica!.words[0], knowledge_level: 2}
  await request('/api/words/21', {method: 'PUT', body: JSON.stringify({knowledge_level: 4})})
  await request('/api/words/21', {method: 'PUT', body: JSON.stringify({is_favorite: true})})
  const [conflicting, later] = structuredClone(fake.replica!.changes)
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  const applied: Replica['changes'] = []
  const fields = [{field: 'knowledge_level', before: 1, device: 4, server: 2}]
  fake.network.mockImplementation(async (path: string, init: RequestInit) => {
    if (path === '/auth/session') return {csrf_token: 'test-only'}
    if (path === '/api/offline/snapshot?include_revisions=true&include_cursor=true') {
      return {version: 1, words: [serverWord], topics: []}
    }
    expect(path).toBe('/api/offline/changes')
    expect(init.headers).toMatchObject({'X-Lexora-Conflict-Details': 'true'})
    const edit = JSON.parse(String(init.body))
    if (edit.id === conflicting.id) throw new ApiError(409, 'Conflict', {
      code: 'offline_edit_conflict', change_id: edit.id, server_item: serverWord, fields,
    })
    applied.push(edit)
    Object.assign(serverWord, edit.data)
    return {entity_id: 21}
  })

  await offline.syncOffline(true)
  expect(offline.offlineStatus()).toMatchObject({pending: 2, conflict: {changeId: conflicting.id, fields}})
  await offline.resolveOfflineConflict(choice)
  if (choice === 'device') {
    expect(applied[0].id).not.toBe(conflicting.id)
    expect(applied[0].before.knowledge_level).toBe(2)
  }
  expect(applied.map(edit => edit.id)).toHaveLength(choice === 'device' ? 2 : 1)
  expect(applied[applied.length - 1]).toEqual(later)
  expect(fake.replica!.words[0]).toMatchObject({knowledge_level: choice === 'device' ? 4 : 2, is_favorite: true})
  expect(offline.offlineStatus()).toMatchObject({pending: 0, conflict: undefined})
})

it('restores a backup locally and waits for explicit sync, while protecting current pending edits', async () => {
  const {offline, request} = await setup()
  const backup = structuredClone(fake.replica!)
  backup.words[0].term = 'from backup'
  backup.revisions = {version: 1, word_hashes: {}, topic_hashes: {}}
  await request('/api/words/-2', {method: 'PUT', body: JSON.stringify({knowledge_level: 4})})
  await expect(offline.restoreOfflineBackup(backup)).rejects.toThrow('Sync your current edits')
  fake.replica!.changes = []
  await offline.restoreOfflineBackup(backup)
  expect(fake.replica?.words[0].term).toBe('from backup')
  expect(fake.replica?.revisions).toBeUndefined()
  expect(offline.offlineStatus().restorePaused).toBe(true)
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  await offline.syncOffline(true)
  expect(fake.network).not.toHaveBeenCalled()
  fake.network.mockResolvedValueOnce({csrf_token: 'test-only'})
    .mockResolvedValueOnce({version: 1, words: backup.words, topics: backup.topics})
  await offline.resumeOfflineSync()
  expect(fake.network.mock.calls.map(([path]) => path)).toEqual(['/auth/session', '/api/offline/snapshot?include_revisions=true&include_cursor=true'])
  expect(offline.offlineStatus().restorePaused).toBeUndefined()
})

it('retries deferred iOS sign-out with the session CSRF token', async () => {
  fake.ios = true
  Object.defineProperty(navigator, 'locks', {configurable: true, value: {}})
  const {request} = await setup()
  localStorage.setItem('lexora-offline-logout', '1')
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  fake.network.mockResolvedValueOnce({csrf_token: 'test-only'}).mockResolvedValueOnce({ok: true})
  await expect(request('/auth/session')).resolves.toMatchObject({authenticated: false})
  expect(fake.network).toHaveBeenLastCalledWith('/auth/logout', {method: 'POST', headers: {'X-CSRF-Token': 'test-only'}})
  expect(localStorage.getItem('lexora-offline-logout')).toBeNull()
})

it.each([
  'levels=4', 'search=calm', 'cefr_levels=B2', 'positions=noun', 'topic_ids=8',
  'favorites_only=true', 'completeness=complete', 'levels=4&cefr_levels=A1',
])('keeps the saved-copy summary aligned with list filters: %s', async filters => {
  const {request} = await setup()
  fake.replica!.words[0].cefr_level = 'A1'
  fake.replica!.words[0].part_of_speech = 'adjective'
  fake.replica!.topics.push({...structuredClone(fake.replica!.topics[0]), id: 8, name: 'Other', slug: 'other'})
  fake.replica!.words.push({...structuredClone(fake.replica!.words[0]), id: 9, term: 'calm',
    knowledge_level: 4, cefr_level: 'B2', part_of_speech: 'noun', topic_ids: [8], is_favorite: true,
    definition: 'A calm state', translation_entries: ['test translation'], example_entries: ['A calm day.']})
  const list = await request(`/api/words?${filters}`) as {total: number}
  const summary = await request(`/api/words/summary?${filters}`) as {total: number; scope_total: number; level_counts: Record<number, number>}
  const expected = filters === 'levels=4&cefr_levels=A1' ? 0 : 1
  expect(list.total).toBe(expected)
  expect(summary).toEqual({total: expected, scope_total: expected, level_counts: expected ? {4: 1} : {}})
})

it('summarizes every matching word rather than only the current saved-copy page', async () => {
  const {request} = await setup()
  fake.replica!.words.push({...structuredClone(fake.replica!.words[0]), id: 9, term: 'calm', knowledge_level: 4})
  const list = await request('/api/words?page_size=1') as {words: unknown[]; total: number}
  const summary = await request('/api/words/summary?page_size=1')
  expect(list.words).toHaveLength(1)
  expect(list.total).toBe(2)
  expect(summary).toEqual({total: 2, scope_total: 2, level_counts: {1: 1, 4: 1}})
})

it('clears saved data after all-device revocation succeeds', async () => {
  const {request} = await setup()
  fake.network.mockResolvedValueOnce({ok: true})
  await request('/auth/logout-all', {method: 'POST'})
  expect(fake.replica).toBeUndefined()
  expect(fake.network).toHaveBeenCalledWith('/auth/logout-all', {method: 'POST'})
})

it('does not claim all devices are signed out when the network is unavailable', async () => {
  const {request} = await setup()
  fake.network.mockRejectedValueOnce(new TypeError('Network unavailable'))
  await expect(request('/auth/logout-all', {method: 'POST'})).rejects.toThrow('Network unavailable')
  expect(fake.replica?.words).toHaveLength(1)
})

it('copies the current practice set and its progress when saving all words offline', async () => {
  const {offline, request} = await setup()
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  Object.defineProperty(navigator, 'serviceWorker', {configurable: true, value: {
    register: async () => ({active: {state: 'activated'}}), ready: Promise.resolve(),
  }})
  const snapshot = structuredClone(fake.replica!)
  const mix: StudyQueue = {id: 40, generated_at: '2026-10-17', expires_at: '2026-10-18', is_active: true,
    total_count: 1, completed_count: 1, items: [{id: 50, word_id: -2, position: 0, word: snapshot.words[0], is_completed: true, completed_at: '2026-10-17'}]}
  fake.network.mockImplementation(async (path: string) => path === '/api/offline/snapshot?include_revisions=true&include_cursor=true' ? snapshot : mix)
  await offline.saveOffline()
  expect(fake.replica!.mixes!.en).toEqual(mix)
  const savedMix = await request('/api/smart-review') as StudyQueue
  expect(savedMix.id).toBe(40)
  expect(savedMix.completed_count).toBe(1)
})

it('saves only practice state and shares the ID sequence with offline word creation', async () => {
  fake.ios = true
  Object.defineProperty(navigator, 'locks', {configurable: true, value: {}})
  const {request} = await setup()
  const first = await request('/api/smart-review') as StudyQueue
  await request('/api/smart-review')
  expect(fake.writeMix).toHaveBeenCalledTimes(1)
  const next = await request('/api/smart-review/refresh', {method: 'POST'}) as StudyQueue
  expect(next.id).not.toBe(first.id)
  expect(next.items[0].id).not.toBe(first.items[0].id)
  const completed = await request(`/api/smart-review/items/${next.items[0].id}/complete`, {method: 'POST'}) as StudyQueue
  expect(completed.completed_count).toBe(1)
  await expect(request(`/api/smart-review/items/${first.items[0].id}/complete`, {method: 'POST'})).rejects.toThrow('not found')
  expect(fake.write).not.toHaveBeenCalled()
  expect(fake.writeMix).toHaveBeenCalledTimes(3)
  const word = await request('/api/words', {method: 'POST', body: JSON.stringify({term: 'calm', topic_ids: [-1]})}) as {id: number}
  expect(word.id).toBeLessThan(next.items[0].id)
  expect(await request('/api/smart-review')).toMatchObject({id: next.id, completed_count: 1})
  expect(fake.network).not.toHaveBeenCalled()
})

it('keeps rating pages stable but refreshes list counts after CRUD', async () => {
  const {request, refresh} = await setup()
  await request('/api/words/-2', {method: 'PUT', body: JSON.stringify({knowledge_level: 4})})
  expect(refresh).not.toHaveBeenCalled()
  await request('/api/words/-2', {method: 'DELETE'})
  expect(refresh).toHaveBeenLastCalledWith(true)
  expect((await request('/api/words') as {total: number}).total).toBe(0)
  expect(fake.replica?.changes).toHaveLength(2)
})

it('retains an unchanged operation after a lost response, then remaps dependencies on retry', async () => {
  const {request, offline} = await setup()
  await request('/api/words', {method: 'POST', body: JSON.stringify({term: 'calm', topic_ids: [-1], knowledge_level: 1})})
  // The real topic would already have a server ID before any word is synced.
  const {remapId} = await import('../changes')
  remapId(fake.replica!, 'topic', -1, 10)
  const temporary = fake.replica!.words.find(w => w.term === 'calm')!.id
  await request(`/api/words/${temporary}`, {method: 'PUT', body: JSON.stringify({knowledge_level: 4})})
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  const sent: string[] = []
  let dropped = false
  fake.network.mockImplementation(async (path: string, init: RequestInit) => {
    if (path === '/auth/session') return {csrf_token: 'test-only'}
    if (path === '/api/offline/snapshot?include_revisions=true&include_cursor=true') return {version: 1, words: fake.replica!.words, topics: fake.replica!.topics}
    sent.push(String(init.body))
    const edit = JSON.parse(String(init.body))
    if (!dropped) { dropped = true; throw new TypeError('Response lost after server commit') }
    return {entity_id: edit.action === 'create' ? 20 : edit.entity_id}
  })
  await offline.syncOffline()
  expect(fake.replica!.changes).toHaveLength(2)
  await offline.syncOffline()
  expect(sent[1]).toBe(sent[0])
  expect(JSON.parse(sent[2]).entity_id).toBe(20)
  expect(fake.replica!.changes).toHaveLength(0)
  expect(fake.replica!.words.find(w => w.term === 'calm')!.id).toBe(20)
})

it.each(['study_list', 'smart_review'])('retries a saved %s rating with its original practice timestamp', async progressSource => {
  const {request, offline} = await setup()
  const {remapId} = await import('../changes')
  remapId(fake.replica!, 'topic', -1, 1)
  remapId(fake.replica!, 'word', -2, 2)
  await request('/api/words/2', {method: 'PUT', body: JSON.stringify({knowledge_level: 1, progress_source: progressSource})})
  const recordedAt = fake.replica!.changes[0].occurred_at
  expect(recordedAt).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/))
  expect(recordedAt).toBe(fake.replica!.words[0].updated_at)
  await request('/api/words/2', {method: 'PUT', body: JSON.stringify({knowledge_level: 4})})
  expect(fake.replica!.changes[1]).not.toHaveProperty('occurred_at')

  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  const sent: string[] = []
  fake.network.mockImplementation(async (path: string, init: RequestInit) => {
    if (path === '/auth/session') return {csrf_token: 'test-only'}
    if (path === '/api/offline/snapshot?include_revisions=true&include_cursor=true') return {version: 1, words: fake.replica!.words, topics: fake.replica!.topics}
    sent.push(String(init.body))
    if (sent.length === 1) throw new TypeError('Response lost after server commit')
    return {entity_id: 2}
  })
  await offline.syncOffline()
  expect(fake.replica!.changes).toHaveLength(2)
  await offline.syncOffline()

  expect(JSON.parse(sent[0])).toMatchObject({occurred_at: recordedAt, data: {progress_source: progressSource}})
  expect(sent[1]).toBe(sent[0])
  expect(fake.replica!.changes).toHaveLength(0)
})

it('keeps the saved copy and edits available when synchronization hits a conflict', async () => {
  const {request, offline} = await setup()
  const {ApiError} = await import('@/shared/api/apiError')
  await request('/api/words/-2', {method: 'PUT', body: JSON.stringify({knowledge_level: 4})})
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  fake.network.mockImplementation(async (path: string) => {
    if (path === '/auth/session') return {csrf_token: 'test-only'}
    throw new ApiError(409, 'Changed on the server')
  })
  await offline.syncOffline()
  expect(offline.offlineStatus().issues).toMatchObject([{message: 'Changed on the server'}])
  expect(fake.replica!.changes).toHaveLength(1)
  expect((await request('/api/words/-2') as {knowledge_level: number}).knowledge_level).toBe(4)
})

it('opens the saved copy during a server outage but still rejects an expired session', async () => {
  const {request, offline} = await setup()
  const {ApiError} = await import('@/shared/api/apiError')
  fake.network.mockRejectedValueOnce(new ApiError(503, 'Service unavailable'))
  await expect(request('/auth/session')).resolves.toMatchObject({authenticated: true})
  expect(offline.offlineStatus().offline).toBe(true)
  expect(fake.network.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
  fake.network.mockRejectedValueOnce(new ApiError(401, 'Not authenticated'))
  await expect(request('/auth/session')).rejects.toMatchObject({status: 401})
})

it.each([
  {name: 'refreshes failed settings when a manual sync succeeds after a server outage', path: '/account/offline', editing: false},
  {name: 'defers the recovery refresh until the user leaves the word editor', path: '/words/-2/edit', editing: true},
])('$name', async ({path, editing}) => {
  const {request, offline} = await setup()
  const {DEFAULT_PREFERENCES, loadPreferences, preferencesSnapshot} = await import('@/features/preferences/api')
  const {PreferencesEffects} = await import('@/features/preferences/PreferencesEffects')
  await request('/api/words/-2', {method: 'PUT', body: JSON.stringify({knowledge_level: 4})})

  // A server outage can leave the browser online, so recovery never fires an online event.
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  fake.network.mockRejectedValue(new TypeError('Could not reach Lexora'))
  await request('/auth/session')
  await loadPreferences()
  expect(preferencesSnapshot()).toMatchObject({status: 'error', error: expect.stringContaining('Could not load settings')})
  expect(offline.offlineStatus()).toMatchObject({offline: true, pending: 1})
  const router = createMemoryRouter([{path: '*', element: createElement(PreferencesEffects)}], {initialEntries: [path]})
  render(createElement(QueryClientProvider, {client: new QueryClient()},
    createElement(RouterProvider, {router})))

  fake.network.mockImplementation(async (path: string) => {
    if (path === '/auth/session') return {csrf_token: 'test-only'}
    if (path === '/api/offline/changes') return {entity_id: -2}
    if (path === '/api/offline/snapshot?include_revisions=true&include_cursor=true') return {version: 1, words: fake.replica!.words, topics: fake.replica!.topics}
    if (path === '/api/preferences') return {...DEFAULT_PREFERENCES, page_size: 100}
    throw new Error(`Unexpected path: ${path}`)
  })

  await act(() => offline.syncOffline(true))
  expect(offline.offlineStatus()).toMatchObject({offline: false, pending: 0})
  if (editing) {
    expect(preferencesSnapshot()).toMatchObject({status: 'error', values: {page_size: 50}})
    await act(() => router.navigate('/account/offline'))
  }
  await waitFor(() => expect(preferencesSnapshot()).toMatchObject({status: 'saved', error: '', values: {page_size: 100}}))
})

it('keeps local edits responsive during a slow snapshot and never overwrites those edits', async () => {
  const {request, offline} = await setup()
  const {remapId} = await import('../changes')
  remapId(fake.replica!, 'topic', -1, 1)
  remapId(fake.replica!, 'word', -2, 2)
  const server = structuredClone(fake.replica!)
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  let snapshotStarted!: () => void, releaseSnapshot!: () => void
  const started = new Promise<void>(resolve => { snapshotStarted = resolve })
  const slowSnapshot = new Promise<void>(resolve => { releaseSnapshot = resolve })
  let firstSnapshot = true
  fake.network.mockImplementation(async (path: string, init: RequestInit) => {
    if (path === '/auth/session') return {csrf_token: 'test-only'}
    if (path === '/api/offline/snapshot?include_revisions=true&include_cursor=true') {
      const copy = structuredClone(server)
      if (firstSnapshot) { firstSnapshot = false; snapshotStarted(); await slowSnapshot }
      return copy
    }
    const edit = JSON.parse(String(init.body))
    Object.assign(server.words[0], edit.data)
    return {entity_id: edit.entity_id}
  })
  const syncing = offline.syncOffline(true)
  await started
  const editing = request('/api/words/2', {method: 'PUT', body: JSON.stringify({knowledge_level: 4})})
  try {
    const result = await Promise.race([editing, new Promise(resolve => setTimeout(() => resolve('blocked'), 40))])
    expect(result).toMatchObject({knowledge_level: 4})
  } finally { releaseSnapshot(); await syncing; await editing }
  await offline.syncOffline(true)
  expect(fake.replica!.words[0].knowledge_level).toBe(4)
  expect(fake.replica!.changes).toHaveLength(0)
})

it('retains a second local edit made while the first change is uploading', async () => {
  const {request, offline} = await setup()
  const {remapId} = await import('../changes')
  remapId(fake.replica!, 'topic', -1, 1)
  remapId(fake.replica!, 'word', -2, 2)
  await request('/api/words/2', {method: 'PUT', body: JSON.stringify({knowledge_level: 4})})
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  let uploadStarted!: () => void, releaseUpload!: () => void
  const started = new Promise<void>(resolve => { uploadStarted = resolve })
  const slowUpload = new Promise<void>(resolve => { releaseUpload = resolve })
  const beforeLevels: number[] = []
  fake.network.mockImplementation(async (path: string, init: RequestInit) => {
    if (path === '/auth/session') return {csrf_token: 'test-only'}
    if (path === '/api/offline/snapshot?include_revisions=true&include_cursor=true') return structuredClone(fake.replica)
    const edit = JSON.parse(String(init.body))
    beforeLevels.push(edit.before.knowledge_level)
    if (beforeLevels.length === 1) { uploadStarted(); await slowUpload }
    return {entity_id: edit.entity_id}
  })
  const syncing = offline.syncOffline()
  await started
  const editing = request('/api/words/2', {method: 'PUT', body: JSON.stringify({knowledge_level: 5})})
  try {
    await expect(Promise.race([editing, new Promise(resolve => setTimeout(() => resolve('blocked'), 40))])).resolves.toMatchObject({knowledge_level: 5})
  } finally { releaseUpload(); await syncing; await editing }
  expect(beforeLevels).toEqual([1, 4])
  expect(fake.replica!.words[0].knowledge_level).toBe(5)
  expect(fake.replica!.changes).toHaveLength(0)
})

it('preserves a newly completed practice item while refreshing the saved vocabulary', async () => {
  fake.ios = true
  Object.defineProperty(navigator, 'locks', {configurable: true, value: {}})
  const {request, offline} = await setup()
  const mix = await request('/api/smart-review') as StudyQueue
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  let snapshotStarted!: () => void, releaseSnapshot!: () => void
  const started = new Promise<void>(resolve => { snapshotStarted = resolve })
  const slowSnapshot = new Promise<void>(resolve => { releaseSnapshot = resolve })
  let snapshots = 0
  fake.network.mockImplementation(async (path: string) => {
    if (path === '/auth/session') return {csrf_token: 'test-only'}
    const snapshot = {version: 1, words: structuredClone(fake.replica!.words), topics: structuredClone(fake.replica!.topics)}
    if (++snapshots === 1) { snapshotStarted(); await slowSnapshot }
    return snapshot
  })
  const syncing = offline.syncOffline(true)
  await started
  const completing = request(`/api/smart-review/items/${mix.items[0].id}/complete`, {method: 'POST'})
  try {
    await expect(Promise.race([completing, new Promise(resolve => setTimeout(() => resolve('blocked'), 40))])).resolves.toMatchObject({completed_count: 1})
  } finally { releaseSnapshot(); await syncing; await completing }
  expect(fake.replica!.mixes!.en.completed_count).toBe(1)
  expect(snapshots).toBe(1)
})
