import {appendOfflineValue, deleteOfflineValue, mutateOfflineValue, readOfflineValue, readReplica} from '@/features/offline/storage'
import {networkRequest} from '@/shared/api/http'
import {CSRF_TOKEN_STORAGE_KEY} from '@/shared/auth/storage'
import type {Word} from '@/features/words/types/wordTypes'

const RECALL_HISTORY = 'recall-history-v1'
const DAY_MS = 24 * 60 * 60 * 1000
const DELAYS = [1, 3, 7, 14, 30]
const ENDPOINT = '/api/stats/learning/recall'
let flushing: Promise<void> | undefined
let historyEpoch = 0
export type RecallAttempt = {
  wordId: number
  recalled: boolean
  occurredAt: string
  language: string
  translationLanguage: string
  id?: string
  uploaded?: boolean
}
type WireAttempt = {id: string; word_id: number; recalled: boolean; occurred_at: string; language: string; translation_language: string}

export async function readRecallHistory() {
  return await readOfflineValue<RecallAttempt[]>(RECALL_HISTORY) ?? []
}

export async function saveRecallAttempt(event: RecallAttempt) {
  await appendOfflineValue(RECALL_HISTORY, {...event, id: event.id ?? crypto.randomUUID()}, (attempt: RecallAttempt) =>
    attempt.wordId === event.wordId && attempt.occurredAt === event.occurredAt
    && attempt.language === event.language && attempt.translationLanguage === event.translationLanguage)
  void syncRecallAttempts()
}

export function clearRecallHistory() {
  historyEpoch++
  return deleteOfflineValue(RECALL_HISTORY)
}

export async function pendingRecallCount() {
  return (await readRecallHistory()).filter(attempt => !attempt.uploaded).length
}

export function syncRecallAttempts(): Promise<void> {
  if (!navigator.onLine || !('indexedDB' in window) || !localStorage.getItem(CSRF_TOKEN_STORAGE_KEY)) return Promise.resolve()
  if (flushing) return flushing
  const epoch = historyEpoch
  flushing = (async () => {
    const history = await readRecallHistory()
    if (epoch !== historyEpoch) return
    if (history.some(attempt => !attempt.id)) {
      // Assign IDs to legacy device attempts before sending them. Retries use the original ID.
      await mutateOfflineValue<RecallAttempt>(RECALL_HISTORY, rows => rows.map(attempt =>
        attempt.id ? attempt : {...attempt, id: crypto.randomUUID()}))
    }
    while (navigator.onLine && epoch === historyEpoch) {
      const pending = (await readRecallHistory()).filter(attempt => attempt.id && !attempt.uploaded).slice(0, 100)
      if (!pending.length) return
      const attempts = pending.map(attempt => ({
        id: attempt.id!, word_id: attempt.wordId, recalled: attempt.recalled, occurred_at: attempt.occurredAt,
        language: attempt.language, translation_language: attempt.translationLanguage,
      }))
      const result = await networkRequest<{accepted_ids: string[]; discarded_ids: string[]}>(ENDPOINT, {
        method: 'POST', body: JSON.stringify({attempts}), signal: AbortSignal.timeout(12_000),
      })
      if (epoch !== historyEpoch) return
      const accepted = new Set(result.accepted_ids), discarded = new Set(result.discarded_ids)
      if (pending.some(attempt => !accepted.has(attempt.id!) && !discarded.has(attempt.id!))) return
      await mutateOfflineValue<RecallAttempt>(RECALL_HISTORY, rows => rows
        .filter(attempt => !attempt.id || !discarded.has(attempt.id))
        .map(attempt => attempt.id && accepted.has(attempt.id) ? {...attempt, uploaded: true} : attempt))
    }
  })().catch(() => {
    // The locally committed events remain queued for the next reconnect or practice.
  }).finally(() => { flushing = undefined })
  return flushing
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
      await mutateOfflineValue<RecallAttempt>(RECALL_HISTORY, rows => {
        const merged = new Map(rows.filter(row => row.id).map(row => [row.id, row]))
        for (const attempt of response.attempts) merged.set(attempt.id, {
          id: attempt.id, wordId: attempt.word_id, recalled: attempt.recalled, occurredAt: attempt.occurred_at,
          language: attempt.language, translationLanguage: attempt.translation_language, uploaded: true,
        })
        return [...rows.filter(row => !row.id), ...merged.values()]
      })
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
