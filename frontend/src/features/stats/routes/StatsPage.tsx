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
  findBestDay,
  findWorstDay,
  sortTopics,
  sumActivity,
  type ActivityPeriod,
  type MonthPeriod,
  type TopicSort,
} from '@/features/stats/model/statsPageModel'
import {queryKeys} from '@/app/queryKeys'

export {filterByDays, toLocalDateKey} from '@/features/stats/model/statsPageModel'

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

  if (isLoading) return <StatsPageSkeleton />
  if (!stats) return <div className="stats-loading">Failed to load statistics.</div>

  const overview = stats.overview
  const totalWords = overview.total_words
  const activeMinutes = Math.round(stats.usage_summary.total_active_seconds / 60)

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
          <SectionTitle>Vocabulary overview</SectionTitle>
          <div className="stats-cards stats-cards-4">
            <StatCard value={overview.total_words} label="Total words" />
            <StatCard value={overview.total_topics} label="Topics" />
            <StatCard value={stats.level_counts.level_4} label="Strong (lvl 4)" />
            <StatCard value={`${stats.okay_or_better_pct}%`} label="Okay or better" />
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
