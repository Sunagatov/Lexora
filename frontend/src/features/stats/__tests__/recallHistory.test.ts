import {summarizeRecallHistory, type RecallAttempt} from '@/features/stats/model/recallHistory'

it('counts delayed attempts from the previous attempt in the same practice language pair', () => {
  const attempt = (wordId: number, occurredAt: string, recalled: boolean, translationLanguage = 'ru'): RecallAttempt =>
    ({wordId, occurredAt, recalled, language: 'en', translationLanguage})
  const history = [
    attempt(1, '2026-11-26T12:30:00Z', true),
    attempt(1, '2026-11-26T12:20:00Z', true, 'en'),
    attempt(1, '2026-11-25T12:00:00Z', false),
    attempt(1, '2026-11-26T12:00:00Z', true),
    attempt(1, '2026-11-27T12:30:00Z', false),
    attempt(2, '2026-11-27T13:00:00Z', true),
  ]
  expect(summarizeRecallHistory(history, 'en', 'ru')).toEqual({
    attempts: 5, recalled: 3, delayed: 2, delayedRecalled: 1, scheduled: 1, scheduledRecalled: 1,
  })
  expect(summarizeRecallHistory(history, 'en', 'en')).toEqual({
    attempts: 1, recalled: 1, delayed: 0, delayedRecalled: 0, scheduled: 0, scheduledRecalled: 0,
  })
})
