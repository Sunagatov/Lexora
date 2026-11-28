import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {buildStatsPageDerivedData} from '@/features/stats/model/statsPageModel'
import type {LearningStatsResponse} from '@/features/stats/types/statsTypes'

function makeStats(): LearningStatsResponse {
  const period = {attempts: 15, unique_words: 8, first_reviews: 5, repeat_reviews: 10,
    improved_words: 4, regressed_words: 2, study_days: 5}
  return {
    as_of: '2024-03-10',
    review_periods: {'7': period, '30': period, '90': period, '365': period, all: period, previous_week: period},
    level_counts: {
      unset: 10,
      level_1: 15,
      level_2: 0,
      level_3: 45,
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
    review_history: {reviewed_words: 90, improved_words: 20, regressed_words: 5},
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
    mix_activity: {started: 4, completed: 3, in_progress: 1, unfinished: 0, completion_rate_pct: 100, avg_completion_span_seconds: 600},
    usage_daily: [
      {date: '2024-03-06', active_seconds: 100},
      {date: '2024-03-07', active_seconds: 120},
      {date: '2024-03-08', active_seconds: 140},
      {date: '2024-03-09', active_seconds: 160},
      {date: '2024-03-10', active_seconds: 180},
    ],
    topics: [
      {id: 1, name: 'Alpha', slug: 'alpha', reviewed_count: 6, improved_count: 2, regressed_count: 2},
      {id: 2, name: 'Beta', slug: 'beta', reviewed_count: 15, improved_count: 4, regressed_count: 0},
    ],
    daily_activity: [
      {date: '2024-03-06', reviewed: 1, improved: 1, downgraded: 0, net: 1},
      {date: '2024-03-07', reviewed: 2, improved: 2, downgraded: 0, net: 2},
      {date: '2024-03-08', reviewed: 3, improved: 2, downgraded: 1, net: 1},
      {date: '2024-03-09', reviewed: 4, improved: 1, downgraded: 2, net: -1},
      {date: '2024-03-10', reviewed: 5, improved: 4, downgraded: 0, net: 4},
    ],
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
    const derived = buildStatsPageDerivedData(makeStats(), '7', '7', 'reviewed_count')

    expect(derived.filteredActivity).toHaveLength(5)
    expect(derived.periodUsage).toEqual({seconds: 700, days: 5})
    expect(derived.sortedTopics.map((topic) => topic.slug)).toEqual(['beta', 'alpha'])
    expect(derived.bestDay?.date).toBe('2024-03-10')
    expect(derived.worstDay?.date).toBe('2024-03-09')
    expect(derived.overviewCards).toHaveLength(3)
    expect(derived.overviewCards[0]).toMatchObject({label: 'Active time', value: '11m 40s'})
    expect(derived.overviewCards[1]).toMatchObject({
      label: 'Unique words reviewed', value: 8, trend: {value: '0%'},
    })
    expect(derived.overviewCards[2]).toMatchObject({label: 'Study days', value: 5})
    expect(derived.overviewCards[0]?.sparkline).toEqual([0, 0, 100, 120, 140, 160, 180])
  })
})
