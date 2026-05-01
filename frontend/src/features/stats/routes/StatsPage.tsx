import {useMemo, useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {useQuery} from '@tanstack/react-query'
import {fetchStats} from '@/features/stats/api/statsApi'
import {InsightsStrip} from '@/features/stats/components/StatsInsights'
import {
  AppTimeSection,
  ConsistencySection,
  EfficiencySection,
  QueueQualitySection,
  RetentionSection,
} from '@/features/stats/components/StatsPageSections'
import {
  DailyProgressSection,
  DataQualitySection,
  KnowledgeDistributionSection,
  TopicsSection,
  WordsAddedSection,
} from '@/features/stats/components/StatsDetailSections'
import {SectionTitle, StatCard} from '@/features/stats/components/StatsComponents'
import {
  buildActivityChartData,
  buildMonthChartData,
  buildUsageChartData,
  filterByDays,
  filterPreviousDays,
  findBestDay,
  percentDelta,
  findWorstDay,
  sortTopics,
  sumActivity,
  sumUsageSeconds,
  type ActivityPeriod,
  type MonthPeriod,
  type TopicSort,
} from '@/features/stats/model/statsPageModel'
import {queryKeys} from '@/app/queryKeys'

export {filterByDays, toLocalDateKey} from '@/features/stats/model/statsPageModel'

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
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

function StatsPageSkeleton() {
  return (
    <div className="stats-page">
      <div className="stats-inner">
        <div className="stats-topbar">
          <div className="sk" style={{width: 48, height: 14}} />
          <div className="sk" style={{width: 100, height: 22}} />
        </div>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10}}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="sk" style={{height: 64, borderRadius: 14}} />
          ))}
        </div>
        <div className="stats-section">
          <div className="sk" style={{height: 12, width: 150}} />
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10}}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="sk" style={{height: 72, borderRadius: 10}} />
            ))}
          </div>
        </div>
        {[140, 100, 90].map((h, i) => (
          <div key={i} className="stats-section">
            <div className="sk" style={{height: 12, width: 120}} />
            <div className="sk" style={{height: h, borderRadius: 8}} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function StatsPage() {
  const navigate = useNavigate()
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

  if (isLoading) return <StatsPageSkeleton />
  if (!stats) return <div className="stats-loading">Failed to load statistics.</div>

  const overview = stats.overview
  const totalWords = overview.total_words
  const activeMinutes = Math.round(stats.usage_summary.total_active_seconds / 60)
  const now = new Date()
  const currentMonthAdds = stats.words_added_by_month[monthKey(now)] ?? 0
  const previousMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const previousMonthAdds = stats.words_added_by_month[monthKey(previousMonthDate)] ?? 0

  return (
    <div className="stats-page">
      <div className="stats-inner">
        <div className="stats-topbar">
          <button type="button" className="word-page-back-btn" onClick={() => navigate(-1)}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="9,2 4,7 9,12" />
            </svg>
            Back
          </button>
          <h1 className="stats-title">Statistics</h1>
        </div>

        <InsightsStrip s={stats} />

        <section className="stats-section">
          <SectionTitle icon="🏆" subtitle="Headline metrics with recent movement">
            Vocabulary overview
          </SectionTitle>
          <div className="stats-cards stats-cards-4">
            <StatCard
              value={overview.total_words}
              label="Total words"
              sub={`${currentMonthAdds.toLocaleString()} added this month`}
              trend={buildTrendLabel(currentMonthAdds, previousMonthAdds, 'vs last month')}
            />
            <StatCard
              value={currentWeeklyUsage}
              label="This week"
              sub="active seconds"
              trend={buildTrendLabel(currentWeeklyUsage, previousWeeklyUsage, 'vs previous 7d')}
            />
            <StatCard
              value={weeklyActivityTotals?.reviewed ?? 0}
              label="Level changes"
              sub="last 7 days"
              trend={buildTrendLabel(weeklyActivityTotals?.reviewed ?? 0, previousWeeklyActivityTotals?.reviewed ?? 0, 'vs previous 7d')}
            />
            <StatCard
              value={stats.okay_or_better_pct}
              label="Okay or better"
              sub={`${stats.level_counts.level_4.toLocaleString()} strong words`}
              trend={buildTrendLabel(weeklyActivityTotals?.net ?? 0, previousWeeklyActivityTotals?.net ?? 0, 'net this week')}
            />
          </div>
        </section>

        <AppTimeSection
          stats={stats}
          usagePeriod={usagePeriod}
          onUsagePeriodChange={setUsagePeriod}
          usageChartData={usageChartData}
        />
        <RetentionSection stats={stats} totalWords={totalWords} />
        <ConsistencySection stats={stats} />
        <EfficiencySection stats={stats} activeMinutes={activeMinutes} />
        {stats.queue_summary.total_queues > 0
          ? <QueueQualitySection stats={stats} />
          : <section className="stats-section"><SectionTitle>Queue quality</SectionTitle><div className="stats-empty">No smart review queues recorded yet.</div></section>}
        <KnowledgeDistributionSection stats={stats} totalWords={totalWords} />
        <DailyProgressSection
          stats={stats}
          activityPeriod={activityPeriod}
          onActivityPeriodChange={setActivityPeriod}
          activityTotals={activityTotals}
          filteredActivity={filteredActivity}
          activityChartData={activityChartData}
          bestDay={bestDay}
          worstDay={worstDay}
        />
        <WordsAddedSection
          monthPeriod={monthPeriod}
          onMonthPeriodChange={setMonthPeriod}
          monthChartData={monthChartData}
        />
        <TopicsSection
          topics={sortedTopics}
          topicSort={topicSort}
          onTopicSortChange={setTopicSort}
          topicExpanded={topicExpanded}
          onTopicExpandedChange={setTopicExpanded}
        />
        <DataQualitySection stats={stats} totalWords={totalWords} />
      </div>
    </div>
  )
}
