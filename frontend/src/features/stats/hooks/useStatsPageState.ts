import {useMemo, useState} from 'react'
import {useQuery} from '@tanstack/react-query'
import {queryKeys} from '@/app/queryKeys'
import {fetchStats} from '@/features/stats/api/statsApi'
import {
  buildActivityChartData,
  buildMonthChartData,
  buildUsageChartData,
  filterByDays,
  filterPreviousDays,
  findBestDay,
  findWorstDay,
  percentDelta,
  sortTopics,
  sumActivity,
  sumUsageSeconds,
  type ActivityPeriod,
  type MonthPeriod,
  type TopicSort,
} from '@/features/stats/model/statsPageModel'

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function sparklineValues(values: number[], count = 10) {
  return values.slice(-count)
}

function buildTrendLabel(current: number, previous: number, suffix: string) {
  const delta = percentDelta(current, previous)
  if (delta === null) return {value: `${current.toLocaleString()} ${suffix}`, direction: 'up' as const, tone: 'good' as const}
  if (delta === 0) return {value: `0% ${suffix}`, direction: 'flat' as const, tone: 'neutral' as const}
  return {
    value: `${delta > 0 ? '+' : ''}${Math.round(delta)}% ${suffix}`,
    direction: delta > 0 ? 'up' as const : 'down' as const,
    tone: delta > 0 ? 'good' as const : 'bad' as const,
  }
}

export function useStatsPageState() {
  const {data: stats, isLoading} = useQuery({queryKey: queryKeys.stats, queryFn: fetchStats})

  const [activityPeriod, setActivityPeriod] = useState<ActivityPeriod>('30')
  const [usagePeriod, setUsagePeriod] = useState<ActivityPeriod>('30')
  const [monthPeriod, setMonthPeriod] = useState<MonthPeriod>('all')
  const [topicSort, setTopicSort] = useState<TopicSort>('worst')
  const [topicExpanded, setTopicExpanded] = useState(false)

  const filteredActivity = useMemo(
    () => (stats ? filterByDays(stats.daily_activity, activityPeriod) : []),
    [stats, activityPeriod],
  )
  const filteredUsage = useMemo(
    () => (stats ? filterByDays(stats.usage_daily, usagePeriod) : []),
    [stats, usagePeriod],
  )
  const activityTotals = useMemo(() => sumActivity(filteredActivity), [filteredActivity])
  const activityChartData = useMemo(() => buildActivityChartData(filteredActivity), [filteredActivity])
  const usageChartData = useMemo(() => buildUsageChartData(filteredUsage), [filteredUsage])
  const monthChartData = useMemo(() => (stats ? buildMonthChartData(stats, monthPeriod) : []), [stats, monthPeriod])
  const sortedTopics = useMemo(() => (stats ? sortTopics(stats.topics, topicSort) : []), [stats, topicSort])
  const bestDay = useMemo(() => findBestDay(filteredActivity), [filteredActivity])
  const worstDay = useMemo(() => findWorstDay(filteredActivity), [filteredActivity])
  const weeklyActivityTotals = useMemo(() => (stats ? sumActivity(filterByDays(stats.daily_activity, '7')) : null), [stats])
  const previousWeeklyActivityTotals = useMemo(() => (stats ? sumActivity(filterPreviousDays(stats.daily_activity, 7)) : null), [stats])
  const currentWeeklyUsage = useMemo(() => (stats ? sumUsageSeconds(filterByDays(stats.usage_daily, '7')) : 0), [stats])
  const previousWeeklyUsage = useMemo(() => (stats ? sumUsageSeconds(filterPreviousDays(stats.usage_daily, 7)) : 0), [stats])

  const overviewCards = useMemo(() => {
    if (!stats) return []

    const now = new Date()
    const currentMonthAdds = stats.words_added_by_month[monthKey(now)] ?? 0
    const previousMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const previousMonthAdds = stats.words_added_by_month[monthKey(previousMonthDate)] ?? 0
    const monthAddSparkline = sparklineValues(
      Object.entries(stats.words_added_by_month)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, value]) => value),
      8,
    )
    const usageSparkline = sparklineValues(filteredUsage.map((day) => day.active_seconds), 12)
    const activitySparkline = sparklineValues(filteredActivity.map((day) => day.net), 12)
    const levelDistributionSparkline = [
      stats.level_counts.level_1,
      stats.level_counts.level_2,
      stats.level_counts.level_3,
      stats.level_counts.level_4,
      stats.level_counts.level_5,
      stats.level_counts.unset,
    ]

    return [
      {
        value: stats.overview.total_words,
        label: 'Total words',
        sub: `${currentMonthAdds.toLocaleString()} added this month`,
        trend: buildTrendLabel(currentMonthAdds, previousMonthAdds, 'vs last month'),
        sparkline: monthAddSparkline,
      },
      {
        value: currentWeeklyUsage,
        label: 'This week',
        sub: 'active seconds',
        trend: buildTrendLabel(currentWeeklyUsage, previousWeeklyUsage, 'vs previous 7d'),
        sparkline: usageSparkline,
      },
      {
        value: weeklyActivityTotals?.reviewed ?? 0,
        label: 'Level changes',
        sub: 'last 7 days',
        trend: buildTrendLabel(weeklyActivityTotals?.reviewed ?? 0, previousWeeklyActivityTotals?.reviewed ?? 0, 'vs previous 7d'),
        sparkline: activitySparkline,
      },
      {
        value: stats.okay_or_better_pct,
        label: 'Okay or better',
        sub: `${stats.level_counts.level_4.toLocaleString()} strong words`,
        trend: buildTrendLabel(weeklyActivityTotals?.net ?? 0, previousWeeklyActivityTotals?.net ?? 0, 'net this week'),
        sparkline: levelDistributionSparkline,
      },
    ]
  }, [
    currentWeeklyUsage,
    filteredActivity,
    filteredUsage,
    previousWeeklyActivityTotals,
    previousWeeklyUsage,
    stats,
    weeklyActivityTotals,
  ])

  return {
    stats,
    isLoading,
    activityPeriod,
    setActivityPeriod,
    usagePeriod,
    setUsagePeriod,
    monthPeriod,
    setMonthPeriod,
    topicSort,
    setTopicSort,
    topicExpanded,
    setTopicExpanded,
    filteredActivity,
    activityTotals,
    activityChartData,
    usageChartData,
    monthChartData,
    sortedTopics,
    bestDay,
    worstDay,
    overviewCards,
  }
}
