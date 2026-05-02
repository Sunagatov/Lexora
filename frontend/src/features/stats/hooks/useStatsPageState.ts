import {useMemo, useState} from 'react'
import {useQuery} from '@tanstack/react-query'
import {queryKeys} from '@/app/queryKeys'
import {fetchStats} from '@/features/stats/api/statsApi'
import {
  buildStatsPageDerivedData,
  type ActivityPeriod,
  type MonthPeriod,
  type TopicSort,
} from '@/features/stats/model/statsPageModel'

export function useStatsPageState() {
  const {data: stats, isLoading} = useQuery({queryKey: queryKeys.stats, queryFn: fetchStats})

  const [activityPeriod, setActivityPeriod] = useState<ActivityPeriod>('30')
  const [usagePeriod, setUsagePeriod] = useState<ActivityPeriod>('30')
  const [monthPeriod, setMonthPeriod] = useState<MonthPeriod>('all')
  const [topicSort, setTopicSort] = useState<TopicSort>('worst')
  const [topicExpanded, setTopicExpanded] = useState(false)

  const derived = useMemo(
    () => stats
      ? buildStatsPageDerivedData(stats, activityPeriod, usagePeriod, monthPeriod, topicSort)
      : {
        filteredActivity: [],
        activityTotals: {reviewed: 0, improved: 0, downgraded: 0, net: 0},
        activityChartData: [],
        usageChartData: [],
        monthChartData: [],
        sortedTopics: [],
        bestDay: null,
        worstDay: null,
        overviewCards: [],
      },
    [stats, activityPeriod, usagePeriod, monthPeriod, topicSort],
  )

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
    ...derived,
  }
}
