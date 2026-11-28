import {useNavigate} from 'react-router-dom'
import {routes} from '@/app/routes'
import {fetchRevisitPractice, fetchRevisitWords} from '@/features/stats/api/statsApi'
import {InsightsStrip} from '@/features/stats/components/StatsInsights'
import {StatsEntryExplorer} from '@/features/stats/components/StatsEntryExplorer'
import {
  AppTimeSection,
  ConsistencySection,
  DailyMixActivitySection,
  DailyProgressSection,
  KnowledgeDistributionSection,
  ReviewHistorySection,
  TopicsSection,
} from '@/features/stats/components/StatsSections'
import {PeriodTabs, SectionTitle, StatCard, StatsPageSkeleton} from '@/features/stats/components/StatsComponents'
import {useStatsPageState} from '@/features/stats/hooks/useStatsPageState'
import {LEARNING_TOPIC_SORT_OPTIONS, formatDuration} from '@/features/stats/model/statsPageModel'
import {Breadcrumb} from '@/shared/components/Breadcrumb'
import {EmptyState} from '@/shared/components/EmptyState'

function HeroBanner({reviewedWords, strongPct, streak, activeSeconds}: {
  reviewedWords: number
  strongPct: number
  streak: number
  activeSeconds: number
}) {
  return (
    <div className="stats-hero">
      <div className="stats-hero-header">
        <h2 className="stats-hero-title">Learning at a glance</h2>
      </div>
      <div className="stats-hero-cards">
        <div className="stats-hero-card stats-hero-card-words" data-card="words">
          <span className="stats-hero-card-icon">📚</span>
          <span className="stats-hero-card-value">{reviewedWords.toLocaleString()}</span>
          <span className="stats-hero-card-label">Words reviewed</span>
        </div>
        <div className="stats-hero-card stats-hero-card-strong" data-card="strong">
          <span className="stats-hero-card-icon">💪</span>
          <span className="stats-hero-card-value">{strongPct}%</span>
          <span className="stats-hero-card-label">Okay or better</span>
        </div>
        <div className="stats-hero-card stats-hero-card-streak" data-card="streak">
          <span className="stats-hero-card-icon">🔥</span>
          <span className="stats-hero-card-value">{streak.toLocaleString()}</span>
          <span className="stats-hero-card-label">Study streak</span>
        </div>
        <div className="stats-hero-card stats-hero-card-time" data-card="time">
          <span className="stats-hero-card-icon">⏱️</span>
          <span className="stats-hero-card-value">{formatDuration(activeSeconds)}</span>
          <span className="stats-hero-card-label">Active time</span>
        </div>
      </div>
    </div>
  )
}

export function StatsPage({embedded = false}: {embedded?: boolean}) {
  const navigate = useNavigate()
  const s = useStatsPageState()

  if (s.isLoading) return <StatsPageSkeleton />
  if (!s.stats) {
    return (
      <div className="stats-page">
        <div className="stats-inner">
          {!embedded && <Breadcrumb items={[{label: 'Home', onClick: () => navigate(routes.home)}, {label: 'Learning Statistics', isActive: true}]} />}
          <EmptyState
            icon="📈"
            title="Learning statistics unavailable"
            description="Connect to Lexora and try again."
            variant="error"
            actions={[
              {label: 'Retry', onClick: s.retry},
              ...(!embedded ? [{label: 'Back Home', onClick: () => navigate(routes.home), variant: 'secondary' as const}] : []),
            ]}
          />
        </div>
      </div>
    )
  }

  const {stats} = s

  return (
    <div className="stats-page">
      <div className="stats-inner">
        {!embedded && <Breadcrumb items={[{label: 'Home', onClick: () => navigate(routes.home)}, {label: 'Learning Statistics', isActive: true}]} />}
        {!embedded && <div className="stats-topbar">
          <button type="button" className="word-page-back-btn" onClick={() => navigate(-1)}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="9,2 4,7 9,12" />
            </svg>
            Back
          </button>
        </div>}

        <HeroBanner
          reviewedWords={stats.review_history.reviewed_words}
          strongPct={stats.okay_or_better_pct}
          streak={stats.consistency_summary.study_streak_days}
          activeSeconds={stats.usage_summary.total_active_seconds}
        />

        <KnowledgeDistributionSection stats={stats} />

        <section className="stats-section">
          <SectionTitle icon="🧭" subtitle="Practice up to 10 words or open a word to rate it. Repeated setbacks cover the last 30 days.">Words to revisit</SectionTitle>
          <StatsEntryExplorer scope="revisit" load={fetchRevisitWords} loadPractice={fetchRevisitPractice} options={[
            {value: 'weak', label: 'Weak'},
            {value: 'unreviewed', label: 'Never reviewed'},
            {value: 'downgraded', label: 'Repeated setbacks'},
          ]} />
        </section>

        <section className="stats-section">
          <SectionTitle icon="🏆" subtitle="Last 7 days compared with the previous 7">This week</SectionTitle>
          <div className="stats-cards stats-cards-3">
            {s.overviewCards.map((card) => <StatCard key={card.label} {...card} />)}
          </div>
        </section>

        <ReviewHistorySection history={stats.review_history} />
        <AppTimeSection
          stats={stats}
          usagePeriod={s.usagePeriod}
          onUsagePeriodChange={s.setUsagePeriod}
          usageChartData={s.usageChartData}
          periodUsage={s.periodUsage}
        />
        <ConsistencySection stats={stats} />
        <DailyMixActivitySection stats={stats} />
        <DailyProgressSection
          stats={stats}
          activityPeriod={s.activityPeriod}
          onActivityPeriodChange={s.setActivityPeriod}
          filteredActivity={s.filteredActivity}
          activityChartData={s.activityChartData}
          bestDay={s.bestDay}
          worstDay={s.worstDay}
        />
        <InsightsStrip s={stats} />
        <TopicsSection
          topics={s.sortedTopics}
          title="Topic activity"
          subtitle="Recorded reviews grouped by current topic links"
          empty="No topic reviews recorded yet."
          controls={<PeriodTabs options={LEARNING_TOPIC_SORT_OPTIONS} value={s.topicSort} onChange={s.setTopicSort} />}
          columns={[
            {label: 'Reviewed', value: (topic) => topic.reviewed_count},
            {label: 'Improved', value: (topic) => topic.improved_count},
            {label: 'Setbacks', value: (topic) => topic.regressed_count},
          ]}
        />
      </div>
    </div>
  )
}
