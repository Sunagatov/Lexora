import type {DailyActivity, StatsResponse, TopicStat, UsageDay} from '@/features/stats/api/statsApi'

export const LEVEL_LABELS: Record<string, string> = {
  level_1: 'Weak',
  level_2: 'Basic',
  level_3: 'Okay',
  level_4: 'Strong',
  level_5: 'Parked',
  unset: 'No level',
}

export const LEVEL_COLORS: Record<string, string> = {
  level_1: '#dc2626',
  level_2: '#2563eb',
  level_3: '#7c3aed',
  level_4: '#059669',
  level_5: '#cbd5e1',
  unset: '#e2e8f0',
}

export const LEVEL_KEYS = ['level_1', 'level_2', 'level_3', 'level_4', 'level_5', 'unset'] as const

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

export type TopicSort =
  | 'worst'
  | 'best'
  | 'largest'
  | 'weakest'
  | 'most-reviewed'
  | 'least-reviewed'
  | 'most-regressed'

export const TOPIC_SORT_OPTIONS: {value: TopicSort; label: string}[] = [
  {value: 'worst', label: 'Worst first'},
  {value: 'best', label: 'Best first'},
  {value: 'largest', label: 'Largest'},
  {value: 'weakest', label: 'Most weak'},
  {value: 'most-reviewed', label: 'Most reviewed'},
  {value: 'least-reviewed', label: 'Least reviewed'},
  {value: 'most-regressed', label: 'Most regressed'},
]

export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function filterByDays<T extends {date: string}>(days: T[], period: ActivityPeriod): T[] {
  if (period === 'all') return days
  const windowSize = Number(period)
  const cutoff = new Date()
  cutoff.setHours(0, 0, 0, 0)
  cutoff.setDate(cutoff.getDate() - (windowSize - 1))
  const cutoffKey = toLocalDateKey(cutoff)
  return days.filter((day) => day.date >= cutoffKey)
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
  cutoff.setMonth(cutoff.getMonth() - Number(period) + 1)
  cutoff.setDate(1)
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

export function formatRate(value: number): string {
  return `${value.toFixed(1)}/min`
}

export function sortTopics(topics: TopicStat[], sort: TopicSort): TopicStat[] {
  const next = [...topics]
  switch (sort) {
    case 'worst':
      return next.sort((a, b) => a.progress - b.progress)
    case 'best':
      return next.sort((a, b) => b.progress - a.progress)
    case 'largest':
      return next.sort((a, b) => b.total - a.total)
    case 'weakest':
      return next.sort((a, b) => b.weak_count - a.weak_count)
    case 'most-reviewed':
      return next.sort((a, b) => b.reviewed_count - a.reviewed_count)
    case 'least-reviewed':
      return next.sort((a, b) => a.reviewed_count - b.reviewed_count)
    case 'most-regressed':
      return next.sort((a, b) => b.regressed_count - a.regressed_count)
  }
}

export function sumActivity(days: DailyActivity[]) {
  let reviewed = 0
  let improved = 0
  let downgraded = 0
  let net = 0
  for (const day of days) {
    reviewed += day.reviewed
    improved += day.improved
    downgraded += day.downgraded
    net += day.net
  }
  return {reviewed, improved, downgraded, net}
}

export function sumUsageSeconds(days: UsageDay[]) {
  return days.reduce((total, day) => total + day.active_seconds, 0)
}

export function filterPreviousDays<T extends {date: string}>(days: T[], windowSize: number): T[] {
  const end = new Date()
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

export function buildActivityChartData(days: DailyActivity[]) {
  return [...days].reverse().slice(-60).map((day) => ({
    label: dayLabel(day.date),
    value: day.net,
  }))
}

export function buildUsageChartData(days: UsageDay[]) {
  return [...days].reverse().slice(-60).map((day) => ({
    label: dayLabel(day.date),
    value: day.active_seconds,
  }))
}

export function buildMonthChartData(stats: StatsResponse, period: MonthPeriod) {
  const entries = Object.entries(stats.words_added_by_month).sort(([a], [b]) => a.localeCompare(b))
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
