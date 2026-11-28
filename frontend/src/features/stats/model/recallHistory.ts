import {appendOfflineValue, deleteOfflineValue, mutateOfflineValue, readOfflineValue, readRecallUploadState, readReplica, RECALL_HISTORY_KEY} from '@/features/offline/storage'
import {networkRequest} from '@/shared/api/http'
import {ApiError} from '@/shared/api/apiError'
import {CSRF_TOKEN_STORAGE_KEY} from '@/shared/auth/storage'
import type {Word} from '@/features/words/types/wordTypes'

const DAY_MS = 24 * 60 * 60 * 1000
const DELAYS = [1, 3, 7, 14, 30]
const ENDPOINT = '/api/stats/learning/recall'
type RecallSyncState = {pending: number; failed: number; busy: boolean; error?: string}
const syncListeners = new Set<() => void>()
let status: RecallSyncState = {pending: 0, failed: 0, busy: false}
let temporaryError: string | undefined
let flushing: {epoch: number; promise: Promise<void>} | undefined
let historyEpoch = 0
let statusRead = 0
export type RecallAttempt = {
  wordId: number
  recalled: boolean
  occurredAt: string
  language: string
  translationLanguage: string
  id?: string
  uploaded?: boolean
  syncError?: string
}
type WireAttempt = {id: string; word_id: number; recalled: boolean; occurred_at: string; language: string; translation_language: string}
type PendingAttempt = RecallAttempt & {id: string}
type RecallAcknowledgments = {accepted_ids: string[]; discarded_ids: string[]}

export function recallSyncStatus() { return status }

export function subscribeRecallSync(listener: () => void) {
  syncListeners.add(listener)
  return () => { syncListeners.delete(listener) }
}

function publishStatus(patch: Partial<RecallSyncState>) {
  const next = {...status, ...patch}
  if (next.pending === status.pending && next.failed === status.failed &&
    next.busy === status.busy && next.error === status.error) return
  status = next
  for (const listener of syncListeners) listener()
}

export async function refreshRecallSyncStatus() {
  if (!('indexedDB' in window)) return
  const revision = ++statusRead
  const epoch = historyEpoch
  try {
    const pending = (await readRecallHistory()).filter(row => !row.uploaded)
    if (epoch !== historyEpoch || revision !== statusRead) return
    if (!pending.length) temporaryError = undefined
    const failed = pending.filter(row => row.syncError)
    publishStatus({pending: pending.length - failed.length, failed: failed.length,
      error: temporaryError ?? failed[0]?.syncError})
  } catch {
    if (epoch === historyEpoch && revision === statusRead) publishStatus({error: 'Could not read saved recall attempts.'})
  }
}

function updateAttempts(epoch: number, update: (rows: RecallAttempt[]) => RecallAttempt[]) {
  return mutateOfflineValue<RecallAttempt>(RECALL_HISTORY_KEY, rows => epoch === historyEpoch ? update(rows) : rows)
}

function assignMissingIds(epoch: number) {
  return updateAttempts(epoch, rows => rows.some(row => !row.id && !row.uploaded)
    ? rows.map(row => row.id || row.uploaded ? row : {...row, id: crypto.randomUUID()})
    : rows)
}

function sameOutcome(left: RecallAttempt, right: RecallAttempt) {
  return left.wordId === right.wordId && left.language === right.language &&
    left.translationLanguage === right.translationLanguage && left.recalled === right.recalled &&
    Date.parse(left.occurredAt) === Date.parse(right.occurredAt)
}

export async function readRecallHistory() {
  return await readOfflineValue<RecallAttempt[]>(RECALL_HISTORY_KEY) ?? []
}

export async function saveRecallAttempt(event: RecallAttempt) {
  await appendOfflineValue(RECALL_HISTORY_KEY, {...event, id: event.id ?? crypto.randomUUID()}, (attempt: RecallAttempt) =>
    attempt.wordId === event.wordId && attempt.occurredAt === event.occurredAt
    && attempt.language === event.language && attempt.translationLanguage === event.translationLanguage)
  await refreshRecallSyncStatus()
  void syncRecallAttempts()
}

export async function clearRecallHistory() {
  const epoch = ++historyEpoch
  await deleteOfflineValue(RECALL_HISTORY_KEY)
  if (historyEpoch !== epoch) return
  temporaryError = undefined
  publishStatus({pending: 0, failed: 0, busy: false, error: undefined})
}

export async function pendingRecallCount() {
  return (await readRecallHistory()).filter(attempt => !attempt.uploaded).length
}

export async function exportPendingRecallAttempts(): Promise<RecallAttempt[]> {
  const epoch = historyEpoch
  await assignMissingIds(epoch)
  const rows = await readRecallHistory()
  return epoch === historyEpoch ? rows.filter(row => !row.uploaded) : []
}

async function uploadAttempts(pending: PendingAttempt[], epoch: number): Promise<void> {
  if (epoch !== historyEpoch) return
  let acknowledgments: RecallAcknowledgments
  try {
    const attempts = pending.map(attempt => ({
      id: attempt.id, word_id: attempt.wordId, recalled: attempt.recalled, occurred_at: attempt.occurredAt,
      language: attempt.language, translation_language: attempt.translationLanguage,
    }))
    acknowledgments = await networkRequest<RecallAcknowledgments>(ENDPOINT, {
      method: 'POST', body: JSON.stringify({attempts}), signal: AbortSignal.timeout(12_000),
    })
  } catch (error) {
    if (!(error instanceof ApiError) || (error.status !== 409 && error.status !== 422)) throw error
    if (epoch !== historyEpoch) return
    if (pending.length > 1) {
      const middle = Math.floor(pending.length / 2)
      await uploadAttempts(pending.slice(0, middle), epoch)
      await uploadAttempts(pending.slice(middle), epoch)
      return
    }
    const syncError = error.status === 409 ? 'A recall attempt conflicts with one on the server.'
      : 'A recall attempt was rejected by the server.'
    await updateAttempts(epoch, rows => rows.map(row => row.id === pending[0].id && !row.uploaded ? {...row, syncError} : row))
    return
  }
  if (epoch !== historyEpoch) return
  const accepted = new Set(acknowledgments.accepted_ids)
  const discarded = new Set(acknowledgments.discarded_ids)
  const acknowledged = new Map(pending.filter(({id}) => accepted.has(id) !== discarded.has(id))
    .map(({id}) => [id, accepted.has(id)]))
  await updateAttempts(epoch, rows => rows.flatMap(row => {
    if (!row.id || !acknowledged.has(row.id)) return [row]
    if (!acknowledged.get(row.id)) return []
    const uploaded = {...row, uploaded: true}
    delete uploaded.syncError
    return [uploaded]
  }))
  if (acknowledged.size !== pending.length) throw new Error('The server did not acknowledge every recall attempt.')
}

export function syncRecallAttempts(forceRetry = false): Promise<void> {
  if (!('indexedDB' in window) || !navigator.onLine || !localStorage.getItem(CSRF_TOKEN_STORAGE_KEY)) {
    return refreshRecallSyncStatus()
  }
  const epoch = historyEpoch
  if (flushing?.epoch === epoch) {
    return forceRetry ? flushing.promise.then(() => {
      if (epoch === historyEpoch) return syncRecallAttempts(true)
    }) : flushing.promise
  }
  temporaryError = undefined
  const promise = (async () => {
    // Commit identifiers for legacy attempts before uploading any of them.
    await assignMissingIds(epoch)
    const retried = new Set<string>()
    while (navigator.onLine && epoch === historyEpoch) {
      const {attempts, paused, hasReplica} = await readRecallUploadState()
      if (paused && (hasReplica || !forceRetry)) return
      const pending = attempts.filter((attempt): attempt is PendingAttempt =>
        !!attempt.id && !attempt.uploaded && (!attempt.syncError || (forceRetry && !retried.has(attempt.id))))
        .slice(0, 100)
      if (!pending.length) return
      for (const {id} of pending) retried.add(id)
      await uploadAttempts(pending, epoch)
      if (epoch === historyEpoch) await refreshRecallSyncStatus()
    }
  })().catch(error => {
    if (epoch !== historyEpoch) return
    temporaryError = error instanceof ApiError && (error.status === 401 || error.status === 403)
      ? 'Sign in again to sync saved recall attempts.'
      : 'Could not sync recall attempts. They are saved on this device.'
  }).finally(async () => {
    if (epoch !== historyEpoch) return
    await refreshRecallSyncStatus()
    if (epoch !== historyEpoch) return
    flushing = undefined
    publishStatus({busy: false})
  })
  flushing = {epoch, promise}
  publishStatus({busy: true})
  return promise
}

export const recallHistoryQueryKey = ['recall-history'] as const

export async function loadRecallHistory(language: string, translationLanguage: string, signal?: AbortSignal) {
  const epoch = historyEpoch
  if (navigator.onLine) {
    try {
      const response = await networkRequest<{attempts: WireAttempt[]}>(ENDPOINT, {
        headers: {'X-Lexora-Language': language, 'X-Lexora-Translation-Language': translationLanguage}, signal,
      })
      if (epoch !== historyEpoch) return []
      await updateAttempts(epoch, rows => {
        const merged = new Map(rows.filter(row => row.id).map(row => [row.id, row]))
        for (const attempt of response.attempts) {
          const remote = {
            id: attempt.id, wordId: attempt.word_id, recalled: attempt.recalled, occurredAt: attempt.occurred_at,
            language: attempt.language, translationLanguage: attempt.translation_language, uploaded: true,
          }
          const local = merged.get(attempt.id)
          // A conflicting history row cannot acknowledge a locally queued payload with that ID.
          if (!local || local.uploaded || sameOutcome(local, remote)) merged.set(attempt.id, remote)
        }
        return [...rows.filter(row => !row.id), ...merged.values()]
      })
      await refreshRecallSyncStatus()
    } catch (error) {
      if (signal?.aborted) throw error
    }
  }
  return readRecallHistory()
}

function schedule(history: RecallAttempt[], language: string, translationLanguage: string, through = Infinity) {
  const attempts = history.filter(item => item.language === language && item.translationLanguage === translationLanguage
    && Date.parse(item.occurredAt) <= through)
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt) || (a.id ?? '').localeCompare(b.id ?? ''))
  const words = new Map<number, {dueAt: number; successes: number; lastAt: number}>()
  let recalled = 0, delayed = 0, delayedRecalled = 0, scheduled = 0, scheduledRecalled = 0
  for (const attempt of attempts) {
    const now = Date.parse(attempt.occurredAt)
    const previous = words.get(attempt.wordId)
    if (previous && now - previous.lastAt >= DAY_MS) {
      delayed++
      delayedRecalled += Number(attempt.recalled)
    }
    if (previous && now >= previous.dueAt) {
      scheduled++
      scheduledRecalled += Number(attempt.recalled)
    }
    const successes = attempt.recalled ? (previous?.successes ?? 0) + 1 : 0
    const delay = DELAYS[Math.max(0, Math.min(successes, DELAYS.length) - 1)]
    recalled += Number(attempt.recalled)
    words.set(attempt.wordId, {successes, dueAt: now + delay * DAY_MS, lastAt: now})
  }
  return {words, attempts: attempts.length, recalled, delayed, delayedRecalled, scheduled, scheduledRecalled}
}

export function summarizeRecallHistory(history: RecallAttempt[], language: string, translationLanguage: string) {
  const {attempts, recalled, delayed, delayedRecalled, scheduled, scheduledRecalled} = schedule(history, language, translationLanguage)
  return {attempts, recalled, delayed, delayedRecalled, scheduled, scheduledRecalled}
}

export async function loadDueRecallWords(language: string, translationLanguage: 'en' | 'ru', signal: AbortSignal) {
  if (navigator.onLine) {
    await syncRecallAttempts()
    try {
      const [words] = await Promise.all([
        networkRequest<Word[]>(`${ENDPOINT}/due`, {
          headers: {'X-Lexora-Language': language, 'X-Lexora-Translation-Language': translationLanguage}, signal,
        }),
        loadRecallHistory(language, translationLanguage, signal),
      ])
      return words.map(word => ({...word, translation_language: translationLanguage,
        translation_entries: word.translation_groups?.[translationLanguage] ??
          (translationLanguage === 'ru' ? word.translation_entries : [])}))
    } catch (error) {
      if (signal.aborted) throw error
      // An already saved library can provide practice if the server cannot be reached.
      if (!(await readReplica())) throw error
    }
  }
  const [replica, history] = await Promise.all([readReplica(), readRecallHistory()])
  const now = Date.now()
  const {words: dates} = schedule(history, language, translationLanguage, now)
  const candidates = (replica?.words ?? []).filter(word => (word.language ?? 'en') === language &&
    word.id > 0 && !word.deleted_at && word.is_active && word.knowledge_level !== 5).map(word => ({
    word, dueAt: dates.get(word.id)?.dueAt,
    translation: word.translation_groups?.[translationLanguage] ?? (translationLanguage === 'ru' ? word.translation_entries : []),
  })).filter(({word, dueAt, translation}) => translation.length > 0 &&
    (dueAt !== undefined ? dueAt <= now : word.knowledge_level === null || word.knowledge_level === 1))
  candidates.sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity) ||
    a.word.term.localeCompare(b.word.term) || a.word.id - b.word.id)
  return candidates.slice(0, 10).map(({word, translation}) =>
    ({...word, translation_language: translationLanguage, translation_entries: translation}))
}
