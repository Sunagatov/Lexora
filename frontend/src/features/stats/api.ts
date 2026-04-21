import {buildApiUrl, buildRequestHeaders, request} from '../../shared/http'

export type LevelCounts = {
  unset: number
  level_1: number
  level_2: number
  level_3: number
  level_4: number
  level_5: number
}

export type TopicStat = {
  id: number
  name: string
  slug: string
  total: number
  progress: number
  weak_count: number
  strong_count: number
  missing_example: number
  needs_example_enrichment: number
  missing_pos: number
}

export type DailyActivity = {
  date: string        // YYYY-MM-DD
  reviewed: number
  improved: number
  downgraded: number
  net: number
}

export type UsageDay = {
  date: string        // YYYY-MM-DD
  active_seconds: number
}

export type UsageSummary = {
  total_active_seconds: number
  active_days: number
  sessions: number
  avg_session_seconds: number
  longest_session_seconds: number
  today_active_seconds: number
  last_7d_active_seconds: number
}

export type VocabularyOverview = {
  total_words: number
  total_topics: number
  with_example: number
  with_examples_3plus: number
  with_pos: number
  missing_example: number
  needs_example_enrichment: number
  missing_pos: number
  needs_enrichment: number
}

export type StatsResponse = {
  overview: VocabularyOverview
  level_counts: LevelCounts
  okay_or_better_pct: number
  usage_summary: UsageSummary
  usage_daily: UsageDay[]
  topics: TopicStat[]
  daily_activity: DailyActivity[]
  words_added_by_month: Record<string, number>
  tracking_started_at: string | null
  usage_started_at: string | null
}

export const fetchStats = () => request<StatsResponse>('/api/stats')

type UsageEventPayload = {
  event_key: string
  session_key: string
  route: string | null
  active_seconds: number
}

export async function recordUsageEvent(payload: UsageEventPayload): Promise<void> {
  const body = JSON.stringify(payload)
  const response = await fetch(buildApiUrl('/api/stats/usage'), {
    method: 'POST',
    headers: buildRequestHeaders(undefined, body),
    body,
    credentials: 'include',
    keepalive: true,
  })

  if (!response.ok) {
    throw new Error(`Failed to record usage event: ${response.status}`)
  }
}
