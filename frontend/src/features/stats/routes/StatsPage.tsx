import {useNavigate} from 'react-router-dom'
import {InsightsStrip} from '@/features/stats/components/StatsInsights'
import {
  AppTimeSection,
  ConsistencySection,
  DailyProgressSection,
  DataQualitySection,
  EfficiencySection,
  KnowledgeDistributionSection,
  QueueQualitySection,
  RetentionSection,
  TopicsSection,
  WordsAddedSection,
} from '@/features/stats/components/StatsSections'
import {SectionTitle, StatCard} from '@/features/stats/components/StatsComponents'
import {VocabProfileSection, EnrichmentCoverageSection} from '@/features/stats/components/StatsEnrichment'
import {useStatsPageState} from '@/features/stats/hooks/useStatsPageState'
import {formatDuration} from '@/features/stats/model/statsPageModel'

function StatsPageSkeleton() {
  return (
    <div className="stats-page">
      <div className="stats-inner">
        <div className="stats-hero-skeleton">
          <div className="sk" style={{width: 200, height: 28, borderRadius: 8}} />
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 16}}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="sk" style={{height: 80, borderRadius: 16}} />
            ))}
          </div>
        </div>
        {[180, 140, 100].map((h, i) => (
          <div key={i} className="stats-section">
            <div className="sk" style={{height: 14, width: 150}} />
            <div className="sk" style={{height: h, borderRadius: 10}} />
          </div>
        ))}
      </div>
    </div>
  )
}

function HeroBanner({totalWords, strongPct, streak, activeMinutes}: {
  totalWords: number
  strongPct: number
  streak: number
  activeMinutes: number
}) {
  return (
    <div className="stats-hero">
      <div className="stats-hero-header">
        <h1 className="stats-hero-title">Your Vocabulary</h1>
        <p className="stats-hero-subtitle">Progress at a glance</p>
      </div>
      <div className="stats-hero-cards">
        <div className="stats-hero-card stats-hero-card-words" data-card="words">
          <span className="stats-hero-card-icon">📚</span>
          <span className="stats-hero-card-value">{totalWords.toLocaleString()}</span>
          <span className="stats-hero-card-label">Words</span>
        </div>
        <div className="stats-hero-card stats-hero-card-strong" data-card="strong">
          <span className="stats-hero-card-icon">💪</span>
          <span className="stats-hero-card-value">{strongPct}%</span>
          <span className="stats-hero-card-label">Okay or better</span>
        </div>
        <div className="stats-hero-card stats-hero-card-streak" data-card="streak">
          <span className="stats-hero-card-icon">🔥</span>
          <span className="stats-hero-card-value">{streak}</span>
          <span className="stats-hero-card-label">Day streak</span>
        </div>
        <div className="stats-hero-card stats-hero-card-time" data-card="time">
          <span className="stats-hero-card-icon">⏱️</span>
          <span className="stats-hero-card-value">{formatDuration(activeMinutes * 60)}</span>
          <span className="stats-hero-card-label">Active time</span>
        </div>
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
        </div>

        <HeroBanner
          totalWords={totalWords}
          strongPct={stats.okay_or_better_pct}
          streak={stats.consistency_summary.active_streak_days}
          activeMinutes={activeMinutes}
        />

        <InsightsStrip s={stats} />

        <section className="stats-section">
          <SectionTitle icon="🏆" subtitle="Headline metrics with recent movement">
            Vocabulary overview
          </SectionTitle>
          <div className="stats-cards stats-cards-4">
            {s.overviewCards.map((card) => <StatCard key={card.label} {...card} />)}
          </div>
        </section>

        <VocabProfileSection profile={stats.vocab_profile} totalWords={totalWords} />
        <EnrichmentCoverageSection coverage={stats.enrichment_coverage} />

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
