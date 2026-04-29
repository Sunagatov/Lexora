import {request} from '@/shared/api/http'

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
  reviewed_count: number
  regressed_count: number
  never_reviewed_count: number
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

export type RetentionSummary = {
  active_words: number
  reviewed_words: number
  never_reviewed_words: number
  improved_words: number
  regressed_words: number
  strong_words: number
  weak_words: number
  parked_words: number
  reviewed_word_share_pct: number
  improved_word_share_pct: number
  regressed_word_share_pct: number
}

export type EfficiencySummary = {
  total_review_events: number
  reviews_per_active_minute: number
  improved_events_per_active_minute: number
  net_events_per_active_minute: number
  reviewed_words_per_session: number
  improved_words_per_session: number
}

export type ConsistencySummary = {
  active_streak_days: number
  study_streak_days: number
  longest_active_streak_days: number
  longest_study_streak_days: number
  active_days_last_30d: number
  study_days_last_30d: number
  active_days_last_90d: number
  study_days_last_90d: number
}

export type QueueSummary = {
  total_queues: number
  active_queues: number
  completed_queues: number
  completion_rate_pct: number
  avg_queue_size: number
  avg_completion_ratio_pct: number
  avg_completion_seconds: number
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
  retention_summary: RetentionSummary
  efficiency_summary: EfficiencySummary
  consistency_summary: ConsistencySummary
  queue_summary: QueueSummary
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
  await request<void>('/api/stats/usage', {
    method: 'POST',
    body: JSON.stringify(payload),
    keepalive: true,
  })
}
