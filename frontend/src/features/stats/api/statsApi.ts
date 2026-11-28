import {request} from '@/shared/api/http'
import type {LearningStatsResponse, LibraryGap, LibraryStatsResponse, RevisitGroup, StatsEntryPage} from '@/features/stats/types/statsTypes'
import {languagePreferences} from '@/features/languages/api'
import type {Word} from '@/features/words/types/wordTypes'

export const fetchLearningStats = (signal?: AbortSignal) => request<LearningStatsResponse>('/api/stats/learning', {signal})
export const fetchLibraryStats = (signal?: AbortSignal) => request<LibraryStatsResponse>('/api/stats/library', {signal})
export const fetchLibraryGap = (gap: LibraryGap, page: number, signal?: AbortSignal) =>
  request<StatsEntryPage>(`/api/stats/library/entries?gap=${gap}&page=${page}`, {signal})
export const fetchRevisitWords = (group: RevisitGroup, page: number, signal?: AbortSignal) =>
  request<StatsEntryPage>(`/api/stats/learning/revisit?group=${group}&page=${page}`, {signal})
export const fetchRevisitPractice = (group: RevisitGroup, page: number, signal?: AbortSignal) =>
  request<Word[]>(`/api/stats/learning/revisit/practice?group=${group}&page=${page}`, {signal})

type UsageEventPayload = {
  event_key: string
  session_key: string
  route: string | null
  active_seconds: number
}

export async function recordUsageEvent(payload: UsageEventPayload, language = languagePreferences().language): Promise<void> {
  await request<void>('/api/stats/usage', {
    method: 'POST',
    body: JSON.stringify(payload),
    keepalive: true,
    headers: {'X-Lexora-Language': language},
  })
}
