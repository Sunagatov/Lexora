import {useNavigate} from 'react-router-dom'
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
import {useStatsPageState} from '@/features/stats/hooks/useStatsPageState'

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
  const s = useStatsPageState()

  if (s.isLoading) return <StatsPageSkeleton />
  if (!s.stats) return <div className="stats-loading">Failed to load statistics.</div>

  const {stats} = s
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
          <SectionTitle icon="🏆" subtitle="Headline metrics with recent movement">
            Vocabulary overview
          </SectionTitle>
          <div className="stats-cards stats-cards-4">
            {s.overviewCards.map((card) => <StatCard key={card.label} {...card} />)}
          </div>
        </section>

        <AppTimeSection
          stats={stats}
          usagePeriod={s.usagePeriod}
          onUsagePeriodChange={s.setUsagePeriod}
          usageChartData={s.usageChartData}
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
          activityPeriod={s.activityPeriod}
          onActivityPeriodChange={s.setActivityPeriod}
          activityTotals={s.activityTotals}
          filteredActivity={s.filteredActivity}
          activityChartData={s.activityChartData}
          bestDay={s.bestDay}
          worstDay={s.worstDay}
        />
        <WordsAddedSection
          monthPeriod={s.monthPeriod}
          onMonthPeriodChange={s.setMonthPeriod}
          monthChartData={s.monthChartData}
        />
        <TopicsSection
          topics={s.sortedTopics}
          topicSort={s.topicSort}
          onTopicSortChange={s.setTopicSort}
          topicExpanded={s.topicExpanded}
          onTopicExpandedChange={s.setTopicExpanded}
        />
        <DataQualitySection stats={stats} totalWords={totalWords} />
      </div>
    </div>
  )
}
