import type {Replica} from '../types'
import type {StudyQueue} from '@/features/smart-review/types/studyQueueTypes'

const fake = vi.hoisted(() => ({
  replica: undefined as Replica | undefined,
  adapter: undefined as undefined | ((path: string, init: RequestInit, network: (path: string, init: RequestInit) => Promise<unknown>) => Promise<unknown>),
  network: vi.fn(), write: vi.fn(), lock: Promise.resolve() as Promise<unknown>,
}))
vi.mock('@/shared/api/http', () => ({networkRequest: fake.network, setRequestAdapter: (adapter: typeof fake.adapter) => { fake.adapter = adapter }}))
vi.mock('../storage', () => ({
  readReplica: async () => structuredClone(fake.replica),
  writeReplica: async (replica: Replica) => { fake.write(); fake.replica = structuredClone(replica) },
  withOfflineLock: (work: () => Promise<unknown>) => {
    const result = fake.lock.then(work)
    fake.lock = result.catch(() => {})
    return result
  },
}))

async function setup() {
  vi.resetModules()
  vi.stubGlobal('indexedDB', {})
  vi.stubGlobal('BroadcastChannel', class { onmessage = null; postMessage() {} })
  vi.spyOn(window, 'setInterval').mockReturnValue(1)
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  fake.network.mockReset(); fake.write.mockClear(); fake.lock = Promise.resolve()
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

afterEach(() => { Reflect.deleteProperty(navigator, 'serviceWorker'); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('copies the current practice set and its progress when saving all words offline', async () => {
  const {offline, request} = await setup()
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  Object.defineProperty(navigator, 'serviceWorker', {configurable: true, value: {
    register: async () => ({active: {state: 'activated'}}), ready: Promise.resolve(),
  }})
  const snapshot = structuredClone(fake.replica!)
  const mix: StudyQueue = {id: 40, generated_at: '2026-10-17', expires_at: '2026-10-18', is_active: true,
    total_count: 1, completed_count: 1, items: [{id: 50, word_id: -2, position: 0, word: snapshot.words[0], is_completed: true, completed_at: '2026-10-17'}]}
  fake.network.mockImplementation(async (path: string) => path === '/api/offline/snapshot' ? snapshot : mix)
  await offline.saveOffline()
  expect(fake.replica!.mix).toEqual(mix)
  const savedMix = await request('/api/smart-review') as StudyQueue
  expect(savedMix.id).toBe(40)
  expect(savedMix.completed_count).toBe(1)
})

it('does not repeatedly write/broadcast on practice reads and gives each new set unique IDs', async () => {
  const {request} = await setup()
  const first = await request('/api/smart-review') as StudyQueue
  await request('/api/smart-review')
  expect(fake.write).toHaveBeenCalledTimes(1)
  const next = await request('/api/smart-review/refresh', {method: 'POST'}) as StudyQueue
  expect(next.id).not.toBe(first.id)
  expect(next.items[0].id).not.toBe(first.items[0].id)
  const completed = await request(`/api/smart-review/items/${next.items[0].id}/complete`, {method: 'POST'}) as StudyQueue
  expect(completed.completed_count).toBe(1)
  await expect(request(`/api/smart-review/items/${first.items[0].id}/complete`, {method: 'POST'})).rejects.toThrow('not found')
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
    if (path === '/api/offline/snapshot') return {version: 1, words: fake.replica!.words, topics: fake.replica!.topics}
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
  expect(offline.offlineStatus().error).toBe('Changed on the server')
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
    if (path === '/api/offline/snapshot') {
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
    if (path === '/api/offline/snapshot') return structuredClone(fake.replica)
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
  expect(fake.replica!.mix!.completed_count).toBe(1)
  expect(snapshots).toBe(2)
})
