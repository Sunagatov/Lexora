import type {DailyActivity, LearningStatsResponse, LearningTopicStat, LibraryTopicStat, UsageDay} from '@/features/stats/types/statsTypes'

export const LEVEL_LABELS: Record<string, string> = {
  level_1: 'Weak',
  level_3: 'Okay',
  level_4: 'Strong',
  level_5: 'Parked',
  unset: 'Unrated',
}

export const LEVEL_COLORS: Record<string, string> = {
  level_1: '#dc2626',
  level_3: '#7c3aed',
  level_4: '#059669',
  level_5: '#cbd5e1',
  unset: '#e2e8f0',
}

export const LEVEL_KEYS = ['level_1', 'level_3', 'level_4', 'level_5', 'unset'] as const

export type ActivityPeriod = 'all' | '365' | '90' | '30' | '7'
export const ACTIVITY_PERIODS: {value: ActivityPeriod; label: string}[] = [
  {value: '7', label: '7 days'},
  {value: '30', label: '30 days'},
  {value: '90', label: '90 days'},
  {value: '365', label: '1 year'},
  {value: 'all', label: 'All time'},
]

export type MonthPeriod = 'all' | '12' | '6' | '3' | '1'
export const MONTH_PERIODS: {value: MonthPeriod; label: string}[] = [
  {value: '1', label: '1 month'},
  {value: '3', label: '3 months'},
  {value: '6', label: '6 months'},
  {value: '12', label: '1 year'},
  {value: 'all', label: 'All time'},
]

export type LearningTopicSort = 'reviewed_count' | 'improved_count' | 'regressed_count'
export type LibraryTopicSort = 'total' | 'needs_example_enrichment' | 'missing_pos'

export const LEARNING_TOPIC_SORT_OPTIONS: {value: LearningTopicSort; label: string}[] = [
  {value: 'reviewed_count', label: 'Most reviewed'},
  {value: 'improved_count', label: 'Most improved'},
  {value: 'regressed_count', label: 'Most setbacks'},
]

export const LIBRARY_TOPIC_SORT_OPTIONS: {value: LibraryTopicSort; label: string}[] = [
  {value: 'total', label: 'Largest'},
  {value: 'needs_example_enrichment', label: 'Need examples'},
  {value: 'missing_pos', label: 'Missing POS'},
]

export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dayWindow(period: ActivityPeriod, asOf?: string) {
  const start = asOf ? new Date(`${asOf}T00:00:00`) : new Date()
  const end = toLocalDateKey(start)
  if (period === 'all') return {start: null, end}
  start.setDate(start.getDate() - (Number(period) - 1))
  return {start: toLocalDateKey(start), end}
}

export function filterByDays<T extends {date: string}>(days: T[], period: ActivityPeriod, asOf?: string): T[] {
  const {start, end} = dayWindow(period, asOf)
  return days.filter((day) => day.date <= end && (!start || day.date >= start))
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0s'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`
  if (minutes > 0) return `${minutes}m ${remainder > 0 ? `${remainder}s` : ''}`.trim()
  return `${remainder}s`
}

export function filterByMonths(entries: [string, number][], period: MonthPeriod): [string, number][] {
  if (period === 'all') return entries
  const cutoff = new Date()
  cutoff.setDate(1)
  cutoff.setMonth(cutoff.getMonth() - Number(period) + 1)
  const key = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}`
  return entries.filter(([month]) => month >= key)
}

export function monthLabel(key: string): string {
  const [year, month] = key.split('-')
  return `${new Date(Number(year), Number(month) - 1, 1).toLocaleString('default', {month: 'short'})} '${year.slice(2)}`
}

export function dayLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('default', {month: 'short', day: 'numeric'})
}

export function sortTopics<T extends LearningTopicStat | LibraryTopicStat>(topics: T[], count: (topic: T) => number): T[] {
  return [...topics].sort((a, b) => count(b) - count(a) || a.name.localeCompare(b.name))
}

export function sumUsageSeconds(days: UsageDay[]) {
  return days.reduce((total, day) => total + day.active_seconds, 0)
}

export function filterPreviousDays<T extends {date: string}>(days: T[], windowSize: number, asOf?: string): T[] {
  const end = asOf ? new Date(`${asOf}T00:00:00`) : new Date()
  end.setHours(0, 0, 0, 0)
  end.setDate(end.getDate() - windowSize)

  const start = new Date(end)
  start.setDate(start.getDate() - (windowSize - 1))

  const startKey = toLocalDateKey(start)
  const endKey = toLocalDateKey(end)
  return days.filter((day) => day.date >= startKey && day.date <= endKey)
}

export function percentDelta(current: number, previous: number): number | null {
  if (previous === 0 && current === 0) return 0
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}

function buildPeriodChartData<T extends {date: string}>(
  days: T[],
  period: ActivityPeriod,
  trackedFrom: string | null,
  getValue: (day: T) => number,
  asOf?: string,
) {
  const {start, end} = dayWindow(period, asOf)
  let firstTrackedDay = trackedFrom?.slice(0, 10) ?? null
  const dailyValues = new Map<string, number>()

  for (const day of days) {
    if (day.date > end) continue
    if (!firstTrackedDay || day.date < firstTrackedDay) firstTrackedDay = day.date
    if (!start || day.date >= start) {
      dailyValues.set(day.date, (dailyValues.get(day.date) ?? 0) + getValue(day))
    }
  }

  if (!firstTrackedDay || firstTrackedDay > end) return []
  const firstDay = start && start > firstTrackedDay ? start : firstTrackedDay
  const date = new Date(`${firstDay}T00:00:00`)
  const monthly = period === '365' || period === 'all'
  const weekly = period === '90'
  const points: {label: string; value: number}[] = []
  let point: {label: string; value: number} | undefined

  for (let key = firstDay; key <= end; key = toLocalDateKey(date)) {
    const startsBucket = monthly ? date.getDate() === 1 : !weekly || date.getDay() === 1
    if (!point || startsBucket) {
      point = {label: monthly ? monthLabel(key.slice(0, 7)) : dayLabel(key), value: 0}
      points.push(point)
    }
    point.value += dailyValues.get(key) ?? 0
    date.setDate(date.getDate() + 1)
  }

  return points
}

export function buildActivityChartData(days: DailyActivity[], period: ActivityPeriod, trackedFrom: string | null, asOf?: string) {
  return buildPeriodChartData(days, period, trackedFrom, (day) => day.net, asOf)
}

export function buildUsageChartData(days: UsageDay[], period: ActivityPeriod, trackedFrom: string | null, asOf?: string) {
  return buildPeriodChartData(days, period, trackedFrom, (day) => day.active_seconds, asOf)
}

export function buildMonthChartData(wordsByMonth: Record<string, number>, period: MonthPeriod) {
  const entries = Object.entries(wordsByMonth).sort(([a], [b]) => a.localeCompare(b))
  return filterByMonths(entries, period).map(([key, value]) => ({
    label: monthLabel(key),
    value,
  }))
}

export function findBestDay(days: DailyActivity[]) {
  return days.reduce((best, day) => (day.net > (best?.net ?? -Infinity) ? day : best), null as DailyActivity | null)
}

export function findWorstDay(days: DailyActivity[]) {
  return days
    .filter((day) => day.downgraded > 0)
    .reduce((worst, day) => (day.downgraded > (worst?.downgraded ?? -Infinity) ? day : worst), null as DailyActivity | null)
}

export type TrendInfo = {
  value: string
  direction: 'up' | 'down' | 'flat'
  tone: 'good' | 'bad' | 'neutral'
}

export type OverviewCard = {
  value: string | number
  label: string
  trend: TrendInfo
  sparkline: number[]
}

export type StatsPageDerivedData = {
  filteredActivity: DailyActivity[]
  periodUsage: {seconds: number; days: number}
  activityChartData: ReturnType<typeof buildActivityChartData>
  usageChartData: ReturnType<typeof buildUsageChartData>
  sortedTopics: LearningTopicStat[]
  bestDay: DailyActivity | null
  worstDay: DailyActivity | null
  overviewCards: OverviewCard[]
}

function buildTrendLabel(current: number, previous: number): TrendInfo {
  const delta = percentDelta(current, previous)
  if (delta === null) return {value: 'From 0', direction: 'up', tone: 'good'}
  if (delta === 0) return {value: '0%', direction: 'flat', tone: 'neutral'}
  return {
    value: `${delta > 0 ? '+' : ''}${Math.round(delta)}%`,
    direction: delta > 0 ? 'up' : 'down',
    tone: delta > 0 ? 'good' : 'bad',
  }
}

export function buildOverviewCards(
  stats: LearningStatsResponse,
): OverviewCard[] {
  const {as_of: asOf, review_periods: periods} = stats
  const usageSparkline = buildUsageChartData(stats.usage_daily, '7', stats.usage_started_at, asOf).map(({value}) => value)
  const currentWeeklyUsage = sumUsageSeconds(filterByDays(stats.usage_daily, '7', asOf))
  const previousWeeklyUsage = sumUsageSeconds(filterPreviousDays(stats.usage_daily, 7, asOf))
  const week = periods['7']
  const previous = periods.previous_week

  return [
    {
      value: formatDuration(currentWeeklyUsage),
      label: 'Active time',
      trend: buildTrendLabel(currentWeeklyUsage, previousWeeklyUsage),
      sparkline: usageSparkline,
    },
    {
      value: week.unique_words,
      label: 'Unique words reviewed',
      trend: buildTrendLabel(week.unique_words, previous.unique_words),
      sparkline: [],
    },
    {
      value: week.study_days,
      label: 'Study days',
      trend: buildTrendLabel(week.study_days, previous.study_days),
      sparkline: [],
    },
  ]
}

export function buildStatsPageDerivedData(
  stats: LearningStatsResponse,
  activityPeriod: ActivityPeriod,
  usagePeriod: ActivityPeriod,
  topicSort: LearningTopicSort,
): StatsPageDerivedData {
  const asOf = stats.as_of
  const filteredActivity = filterByDays(stats.daily_activity, activityPeriod, asOf)
  const filteredUsage = filterByDays(stats.usage_daily, usagePeriod, asOf)

  return {
    filteredActivity,
    periodUsage: {seconds: sumUsageSeconds(filteredUsage), days: filteredUsage.length},
    activityChartData: buildActivityChartData(stats.daily_activity, activityPeriod, stats.tracking_started_at, asOf),
    usageChartData: buildUsageChartData(stats.usage_daily, usagePeriod, stats.usage_started_at, asOf),
    sortedTopics: sortTopics(stats.topics, (topic) => topic[topicSort]),
    bestDay: findBestDay(filteredActivity),
    worstDay: findWorstDay(filteredActivity),
    overviewCards: buildOverviewCards(stats),
  }
}
