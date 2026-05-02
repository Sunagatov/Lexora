import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {buildStatsPageDerivedData} from '@/features/stats/model/statsPageModel'
import type {StatsResponse} from '@/features/stats/types/statsTypes'

function makeStats(): StatsResponse {
  return {
    overview: {
      total_words: 120,
      total_topics: 4,
      with_example: 90,
      with_examples_3plus: 70,
      with_pos: 100,
      missing_example: 30,
      needs_example_enrichment: 20,
      missing_pos: 10,
      needs_enrichment: 25,
    },
    level_counts: {
      unset: 10,
      level_1: 15,
      level_2: 20,
      level_3: 25,
      level_4: 30,
      level_5: 20,
    },
    okay_or_better_pct: 63,
    usage_summary: {
      total_active_seconds: 3600,
      active_days: 9,
      sessions: 12,
      avg_session_seconds: 300,
      longest_session_seconds: 900,
      today_active_seconds: 500,
      last_7d_active_seconds: 1500,
    },
    retention_summary: {
      active_words: 100,
      reviewed_words: 90,
      never_reviewed_words: 30,
      improved_words: 20,
      regressed_words: 5,
      strong_words: 30,
      weak_words: 15,
      parked_words: 20,
      reviewed_word_share_pct: 75,
      improved_word_share_pct: 22,
      regressed_word_share_pct: 6,
    },
    efficiency_summary: {
      total_review_events: 80,
      reviews_per_active_minute: 2.5,
      improved_events_per_active_minute: 1.2,
      net_events_per_active_minute: 0.8,
      reviewed_words_per_session: 3.5,
      improved_words_per_session: 1.8,
    },
    consistency_summary: {
      active_streak_days: 4,
      study_streak_days: 3,
      longest_active_streak_days: 10,
      longest_study_streak_days: 8,
      active_days_last_30d: 12,
      study_days_last_30d: 9,
      active_days_last_90d: 30,
      study_days_last_90d: 24,
    },
    queue_summary: {
      total_queues: 4,
      active_queues: 1,
      completed_queues: 3,
      completion_rate_pct: 75,
      avg_queue_size: 12,
      avg_completion_ratio_pct: 80,
      avg_completion_seconds: 600,
    },
    usage_daily: [
      {date: '2024-03-06', active_seconds: 100},
      {date: '2024-03-07', active_seconds: 120},
      {date: '2024-03-08', active_seconds: 140},
      {date: '2024-03-09', active_seconds: 160},
      {date: '2024-03-10', active_seconds: 180},
    ],
    topics: [
      {
        id: 1,
        name: 'Alpha',
        slug: 'alpha',
        total: 10,
        progress: 20,
        weak_count: 4,
        strong_count: 1,
        missing_example: 2,
        needs_example_enrichment: 3,
        missing_pos: 1,
        reviewed_count: 6,
        regressed_count: 2,
        never_reviewed_count: 4,
      },
      {
        id: 2,
        name: 'Beta',
        slug: 'beta',
        total: 20,
        progress: 70,
        weak_count: 1,
        strong_count: 10,
        missing_example: 1,
        needs_example_enrichment: 1,
        missing_pos: 0,
        reviewed_count: 15,
        regressed_count: 0,
        never_reviewed_count: 2,
      },
    ],
    daily_activity: [
      {date: '2024-03-06', reviewed: 1, improved: 1, downgraded: 0, net: 1},
      {date: '2024-03-07', reviewed: 2, improved: 2, downgraded: 0, net: 2},
      {date: '2024-03-08', reviewed: 3, improved: 2, downgraded: 1, net: 1},
      {date: '2024-03-09', reviewed: 4, improved: 1, downgraded: 2, net: -1},
      {date: '2024-03-10', reviewed: 5, improved: 4, downgraded: 0, net: 4},
    ],
    words_added_by_month: {
      '2024-02': 8,
      '2024-03': 12,
    },
    tracking_started_at: '2024-03-01',
    usage_started_at: '2024-03-01',
  }
}

describe('buildStatsPageDerivedData', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-03-10T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('builds the derived stats page view model from pure inputs', () => {
    const derived = buildStatsPageDerivedData(makeStats(), '7', '7', 'all', 'worst')

    expect(derived.filteredActivity).toHaveLength(5)
    expect(derived.activityTotals).toEqual({reviewed: 15, improved: 10, downgraded: 3, net: 7})
    expect(derived.sortedTopics.map((topic) => topic.slug)).toEqual(['alpha', 'beta'])
    expect(derived.bestDay?.date).toBe('2024-03-10')
    expect(derived.worstDay?.date).toBe('2024-03-09')
    expect(derived.overviewCards).toHaveLength(4)
    expect(derived.overviewCards[0]).toMatchObject({
      label: 'Total words',
      value: 120,
      sub: '12 added this month',
    })
    expect(derived.overviewCards[2]?.sparkline).toEqual([1, 2, 1, -1, 4])
  })
})
