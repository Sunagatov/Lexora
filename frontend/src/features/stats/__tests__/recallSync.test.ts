import {afterEach, beforeEach, expect, it, vi} from 'vitest'
import {
  clearRecallHistory,
  exportPendingRecallAttempts,
  loadRecallHistory,
  pendingRecallCount,
  readRecallHistory,
  refreshRecallSyncStatus,
  recallSyncStatus,
  subscribeRecallSync,
  syncRecallAttempts,
  type RecallAttempt,
} from '@/features/stats/model/recallHistory'
import {ApiError, networkRequest} from '@/shared/api/http'
import {CSRF_TOKEN_STORAGE_KEY} from '@/shared/auth/storage'
import {mergeRestoredRecall} from '@/features/offline/storage'

const store = vi.hoisted(() => ({attempts: [] as RecallAttempt[], paused: false}))
vi.mock('@/features/offline/storage', async importOriginal => ({
  ...await importOriginal<typeof import('@/features/offline/storage')>(),
  appendOfflineValue: async (_: string, row: RecallAttempt, exists: (item: RecallAttempt) => boolean) => {
    if (!store.attempts.some(exists)) store.attempts = [...store.attempts, row]
  },
  readOfflineValue: async () => store.attempts,
  readRecallUploadState: async () => ({attempts: store.attempts, paused: store.paused, hasReplica: true}),
  mutateOfflineValue: async (_: string, update: (rows: RecallAttempt[]) => RecallAttempt[]) => {
    store.attempts = update(store.attempts)
  },
  deleteOfflineValue: async () => { store.attempts = [] },
  readReplica: vi.fn(),
}))
vi.mock('@/shared/api/http', async importOriginal => ({
  ...await importOriginal<typeof import('@/shared/api/http')>(), networkRequest: vi.fn(),
}))

function attempt(number: number, fields: Partial<RecallAttempt> = {}): RecallAttempt {
  return {
    id: `95c75fa6-bb71-4aea-8b8c-${String(number).padStart(12, '0')}`,
    wordId: number, recalled: true, occurredAt: '2026-11-28T17:00:00Z', language: 'en', translationLanguage: 'ru',
    ...fields,
  }
}

function sentIds(init?: RequestInit): string[] {
  return (JSON.parse(String(init?.body)).attempts as Array<{id: string}>).map(item => item.id)
}

async function mergePendingRecallAttempts(rows: RecallAttempt[]) {
  store.attempts = mergeRestoredRecall(store.attempts, rows)
  await refreshRecallSyncStatus()
}

beforeEach(async () => {
  store.paused = false
  vi.stubGlobal('indexedDB', {})
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  localStorage.setItem(CSRF_TOKEN_STORAGE_KEY, 'test')
  vi.mocked(networkRequest).mockReset()
  await clearRecallHistory()
})

it('keeps restored recall attempts local even on manual retry until the backup is resumed', async () => {
  await mergePendingRecallAttempts([attempt(1)])
  store.paused = true
  await syncRecallAttempts(true)
  expect(recallSyncStatus().pending).toBe(1)
  expect(networkRequest).not.toHaveBeenCalled()
  store.paused = false
  vi.mocked(networkRequest).mockResolvedValueOnce({accepted_ids: [attempt(1).id], discarded_ids: []})
  await syncRecallAttempts()
  expect(recallSyncStatus().pending).toBe(0)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.removeItem(CSRF_TOKEN_STORAGE_KEY)
})

it('surfaces temporary sync errors and clears queued outcomes only after acknowledgments', async () => {
  const changed = vi.fn()
  const unsubscribe = subscribeRecallSync(changed)
  const kept = attempt(1), purged = attempt(2)
  await mergePendingRecallAttempts([kept, purged])
  vi.mocked(networkRequest).mockRejectedValueOnce(new TypeError('Failed to fetch'))

  await syncRecallAttempts()
  expect(recallSyncStatus()).toMatchObject({pending: 2, failed: 0, busy: false, error: expect.any(String)})
  expect(await pendingRecallCount()).toBe(2)
  expect(changed).toHaveBeenCalled()

  vi.mocked(networkRequest).mockResolvedValueOnce({accepted_ids: [kept.id], discarded_ids: [purged.id]})
  await syncRecallAttempts(true)
  expect(recallSyncStatus()).toEqual({pending: 0, failed: 0, busy: false, error: undefined})
  expect(await readRecallHistory()).toEqual([{...kept, uploaded: true}])
  unsubscribe()
})

it('isolates permanent validation failures and retries quarantined outcomes only on request', async () => {
  const conflict = attempt(1), valid = attempt(2), rejected = attempt(3), other = attempt(4)
  await mergePendingRecallAttempts([conflict, valid, rejected, other])
  let reject = true
  vi.mocked(networkRequest).mockImplementation(async <T>(_path: string, init?: RequestInit) => {
    const ids = sentIds(init)
    if (reject && ids.includes(conflict.id!)) throw new ApiError(409, 'A recall attempt ID was reused')
    if (reject && ids.includes(rejected.id!)) throw new ApiError(422, 'Invalid attempt')
    return {accepted_ids: ids, discarded_ids: []} as T
  })

  await syncRecallAttempts()
  expect(recallSyncStatus()).toMatchObject({pending: 0, failed: 2, busy: false, error: expect.any(String)})
  expect(await pendingRecallCount()).toBe(2)
  expect((await exportPendingRecallAttempts()).map(row => row.id)).toEqual([conflict.id, rejected.id])
  expect((await exportPendingRecallAttempts()).every(row => row.syncError)).toBe(true)
  const calls = vi.mocked(networkRequest).mock.calls.length
  await syncRecallAttempts()
  expect(vi.mocked(networkRequest)).toHaveBeenCalledTimes(calls)

  reject = false
  await syncRecallAttempts(true)
  expect(await pendingRecallCount()).toBe(0)
  expect(recallSyncStatus()).toEqual({pending: 0, failed: 0, busy: false, error: undefined})
})

it('preserves unsent IDs in backups and does not replace a rejected local outcome during history reads', async () => {
  const kept = attempt(1, {syncError: 'Recall ID conflict'}), acknowledged = attempt(2, {uploaded: true})
  const legacy = attempt(3, {id: undefined})
  await mergePendingRecallAttempts([kept, acknowledged, legacy, kept])
  const copied = await exportPendingRecallAttempts()
  expect(copied.map(row => row.wordId)).toEqual([1, 3])
  expect(copied[0].id).toBe(kept.id)
  expect(copied[1].id).toEqual(expect.any(String))
  expect(await exportPendingRecallAttempts()).toEqual(copied)

  vi.mocked(networkRequest).mockResolvedValueOnce({attempts: [{
    id: kept.id, word_id: kept.wordId, recalled: false, occurred_at: kept.occurredAt,
    language: kept.language, translation_language: kept.translationLanguage,
  }]})
  await loadRecallHistory('en', 'ru')
  expect(await exportPendingRecallAttempts()).toEqual(copied)
  expect(recallSyncStatus()).toMatchObject({pending: 1, failed: 1, busy: false})
})

it('clears a temporary failure if history confirms that the server accepted the same outcome', async () => {
  const pending = attempt(1)
  await mergePendingRecallAttempts([pending])
  vi.mocked(networkRequest).mockRejectedValueOnce(new TypeError('Lost response'))
  await syncRecallAttempts()
  expect(recallSyncStatus().error).toBeTruthy()

  vi.mocked(networkRequest).mockResolvedValueOnce({attempts: [{
    id: pending.id, word_id: pending.wordId, recalled: pending.recalled, occurred_at: '2026-11-28T20:00:00+03:00',
    language: pending.language, translation_language: pending.translationLanguage,
  }]})
  await loadRecallHistory('en', 'ru')
  expect(await pendingRecallCount()).toBe(0)
  expect(recallSyncStatus()).toEqual({pending: 0, failed: 0, busy: false, error: undefined})
})
