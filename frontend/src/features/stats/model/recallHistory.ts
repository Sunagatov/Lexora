import {appendOfflineValue, deleteOfflineValue, readOfflineValue} from '@/features/offline/storage'

const RECALL_HISTORY = 'recall-history-v1'
const DAY_MS = 24 * 60 * 60 * 1000
export type RecallAttempt = {
  wordId: number
  recalled: boolean
  occurredAt: string
  language: string
  translationLanguage: string
}

export async function readRecallHistory() {
  return await readOfflineValue<RecallAttempt[]>(RECALL_HISTORY) ?? []
}

export function saveRecallAttempt(event: RecallAttempt) {
  return appendOfflineValue(RECALL_HISTORY, event, attempt =>
    attempt.wordId === event.wordId && attempt.occurredAt === event.occurredAt
    && attempt.language === event.language && attempt.translationLanguage === event.translationLanguage)
}

export function clearRecallHistory() {
  return deleteOfflineValue(RECALL_HISTORY)
}

export function summarizeRecallHistory(history: RecallAttempt[], language: string, translationLanguage: string) {
  const attempts = history.filter(item => item.language === language && item.translationLanguage === translationLanguage)
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
  const lastByWord = new Map<number, number>()
  let recalled = 0, delayed = 0, delayedRecalled = 0
  for (const attempt of attempts) {
    const now = Date.parse(attempt.occurredAt)
    const last = lastByWord.get(attempt.wordId)
    if (last !== undefined && now - last >= DAY_MS) {
      delayed++
      delayedRecalled += Number(attempt.recalled)
    }
    recalled += Number(attempt.recalled)
    lastByWord.set(attempt.wordId, now)
  }
  return {attempts: attempts.length, recalled, delayed, delayedRecalled}
}
