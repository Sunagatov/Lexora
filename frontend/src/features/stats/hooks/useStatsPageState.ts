import {useMemo, useState} from 'react'
import {useQuery} from '@tanstack/react-query'
import {queryKeys} from '@/app/queryKeys'
import {fetchLearningStats} from '@/features/stats/api/statsApi'
import {
  buildStatsPageDerivedData,
  type ActivityPeriod,
  type LearningTopicSort,
} from '@/features/stats/model/statsPageModel'

export function useStatsPageState() {
  const {data: stats, isLoading, refetch} = useQuery({
    queryKey: queryKeys.learningStats,
    queryFn: ({signal}) => fetchLearningStats(signal),
  })

  const [activityPeriod, setActivityPeriod] = useState<ActivityPeriod>('30')
  const [usagePeriod, setUsagePeriod] = useState<ActivityPeriod>('30')
  const [topicSort, setTopicSort] = useState<LearningTopicSort>('reviewed_count')

  const derived = useMemo(
    () => stats
      ? buildStatsPageDerivedData(stats, activityPeriod, usagePeriod, topicSort)
      : {
        filteredActivity: [],
        periodUsage: {seconds: 0, days: 0},
        activityChartData: [],
        usageChartData: [],
        sortedTopics: [],
        bestDay: null,
        worstDay: null,
        overviewCards: [],
      },
    [stats, activityPeriod, usagePeriod, topicSort],
  )

  return {
    stats,
    isLoading,
    retry: () => { void refetch() },
    activityPeriod,
    setActivityPeriod,
    usagePeriod,
    setUsagePeriod,
    topicSort,
    setTopicSort,
    ...derived,
  }
}
