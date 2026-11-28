export type LevelCounts = {
  unset: number
  level_1: number
  level_2: number
  level_3: number
  level_4: number
  level_5: number
}

type TopicIdentity = {
  id: number
  name: string
  slug: string
}

export type LibraryTopicStat = TopicIdentity & {
  total: number
  missing_example: number
  needs_example_enrichment: number
  missing_pos: number
}

export type LearningTopicStat = TopicIdentity & {
  reviewed_count: number
  improved_count: number
  regressed_count: number
}

export type DailyActivity = {
  date: string
  reviewed: number
  improved: number
  downgraded: number
  net: number
}

export type UsageDay = {
  date: string
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

export type ReviewHistory = {
  reviewed_words: number
  improved_words: number
  regressed_words: number
}

export type StudyCoverage = {
  reviewed_words: number
  never_reviewed_words: number
  reviewed_word_share_pct: number
}

export type ReviewPeriod = {
  attempts: number
  unique_words: number
  first_reviews: number
  repeat_reviews: number
  improved_words: number
  regressed_words: number
  study_days: number
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

export type DailyMixSummary = {
  started: number
  completed: number
  in_progress: number
  unfinished: number
  completion_rate_pct: number | null
  avg_completion_span_seconds: number | null
}

export type LibraryGap = 'translation' | 'no-examples' | 'needs-examples' | 'no-topic' | 'multiple-topics'
export type RevisitGroup = 'weak' | 'downgraded' | 'unreviewed'
export type StatsEntry = {id: number; term: string; knowledge_level: number | null}
export type StatsEntryPage = {entries: StatsEntry[]; total: number; has_more: boolean}

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

export type VocabProfileSummary = {
  cefr_distribution: Record<string, number>
  register_distribution: Record<string, number>
  pos_distribution: Record<string, number>
}

export type EnrichmentCoverage = {
  total_words: number
  with_definition: number
  with_ipa: number
  with_translation: number
  with_examples: number
  with_synonyms: number
  with_antonyms: number
  with_collocations: number
  with_confusables: number
  with_cefr: number
  with_register: number
}

export type LearningStatsResponse = {
  level_counts: LevelCounts
  okay_or_better_pct: number
  usage_summary: UsageSummary
  review_history: ReviewHistory
  consistency_summary: ConsistencySummary
  mix_activity: DailyMixSummary
  review_periods: Record<'all' | '7' | '30' | '90' | '365' | 'previous_week', ReviewPeriod>
  as_of: string
  usage_daily: UsageDay[]
  topics: LearningTopicStat[]
  daily_activity: DailyActivity[]
  tracking_started_at: string | null
  usage_started_at: string | null
}

export type LibraryStatsResponse = {
  overview: VocabularyOverview
  vocab_profile: VocabProfileSummary
  enrichment_coverage: EnrichmentCoverage
  topics: LibraryTopicStat[]
  words_added_by_month: Record<string, number>
  study_coverage: StudyCoverage
  readiness: {
    translation_language: 'ru' | 'en'
    ready: number
    missing_translation: number
    no_examples: number
    needs_examples: number
    no_topic: number
    multiple_topics: number
  }
}
