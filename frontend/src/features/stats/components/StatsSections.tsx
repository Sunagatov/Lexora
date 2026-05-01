import {useNavigate} from 'react-router-dom'
import {routes} from '@/app/routes'
import type {DailyActivity, StatsResponse, TopicStat} from '@/features/stats/types/statsTypes'
import {BarChart, DonutChart, PeriodTabs, QualityBars, SectionTitle, StatCard} from '@/features/stats/components/StatsComponents'
import {
  ACTIVITY_PERIODS,
  LEVEL_COLORS,
  LEVEL_KEYS,
  LEVEL_LABELS,
  MONTH_PERIODS,
  TOPIC_SORT_OPTIONS,
  dayLabel,
  formatDuration,
  formatRate,
  type ActivityPeriod,
  type MonthPeriod,
  type TopicSort,
} from '@/features/stats/model/statsPageModel'

export function AppTimeSection({
  stats,
  usagePeriod,
  onUsagePeriodChange,
  usageChartData,
}: {
  stats: StatsResponse
  usagePeriod: ActivityPeriod
  onUsagePeriodChange: (value: ActivityPeriod) => void
  usageChartData: {label: string; value: number}[]
}) {
  const usage = stats.usage_summary
  return (
    <section className="stats-section">
      <div className="stats-section-header">
        <SectionTitle icon="⏱️" subtitle="Tracked active usage with idle time removed">
          App time
        </SectionTitle>
        <PeriodTabs options={ACTIVITY_PERIODS} value={usagePeriod} onChange={onUsagePeriodChange} />
      </div>
      <div className="stats-cards stats-cards-4">
        <StatCard value={formatDuration(usage.total_active_seconds)} label="Active time" sub={`${usage.active_days.toLocaleString()} active days`} />
        <StatCard value={formatDuration(usage.today_active_seconds)} label="Today" />
        <StatCard value={formatDuration(usage.last_7d_active_seconds)} label="This week" />
        <StatCard value={usage.sessions.toLocaleString()} label="Sessions" />
      </div>
      <div className="stats-cards stats-cards-2">
        <StatCard value={formatDuration(usage.avg_session_seconds)} label="Avg session" />
        <StatCard value={formatDuration(usage.longest_session_seconds)} label="Longest session" />
      </div>
      {usageChartData.length > 0
        ? <BarChart data={usageChartData} color="#2563eb" formatValue={formatDuration} />
        : <div className="stats-empty">No app activity recorded for this period.</div>}
      {stats.usage_started_at && (
        <div className="stats-tracking-note">
          Active time tracking started {new Date(stats.usage_started_at).toLocaleDateString()}. Idle time is excluded.
        </div>
      )}
    </section>
  )
}

export function RetentionSection({stats, totalWords}: {stats: StatsResponse; totalWords: number}) {
  const retention = stats.retention_summary
  const rows = [
    {label: 'Reviewed coverage', val: retention.reviewed_words, color: '#2563eb'},
    {label: 'Current strong words', val: retention.strong_words, color: '#10b981'},
    {label: 'Never reviewed', val: retention.never_reviewed_words, color: '#f97316'},
  ]
  return (
    <section className="stats-section">
      <SectionTitle icon="🛡️" subtitle="How many words are reviewed, strong, regressed, or untouched">
        Retention quality
      </SectionTitle>
      <div className="stats-cards stats-cards-6">
        <StatCard value={retention.reviewed_words} label="Reviewed words" sub={`${retention.reviewed_word_share_pct}% of library`} />
        <StatCard value={retention.never_reviewed_words} label="Never reviewed" />
        <StatCard value={retention.improved_words} label="Improved words" sub={`${retention.improved_word_share_pct}% of reviewed`} />
        <StatCard value={retention.regressed_words} label="Regressed words" sub={`${retention.regressed_word_share_pct}% of reviewed`} />
        <StatCard value={retention.strong_words} label="Strong now" />
        <StatCard value={retention.parked_words} label="Parked" />
      </div>
      <QualityBars rows={rows} total={totalWords} />
    </section>
  )
}

export function ConsistencySection({stats}: {stats: StatsResponse}) {
  const consistency = stats.consistency_summary
  return (
    <section className="stats-section">
      <SectionTitle icon="🔥" subtitle="Streaks and steady usage windows over time">
        Consistency
      </SectionTitle>
      <div className="stats-cards stats-cards-6">
        <StatCard value={consistency.active_streak_days} label="Active streak" sub="days" />
        <StatCard value={consistency.study_streak_days} label="Study streak" sub="days" />
        <StatCard value={consistency.longest_active_streak_days} label="Longest active" sub="days" />
        <StatCard value={consistency.longest_study_streak_days} label="Longest study" sub="days" />
        <StatCard value={consistency.active_days_last_30d} label="Active days" sub="last 30d" />
        <StatCard value={consistency.study_days_last_30d} label="Study days" sub="last 30d" />
      </div>
      <div className="stats-cards stats-cards-2">
        <StatCard value={`${Math.round((consistency.active_days_last_30d / 30) * 100)}%`} label="App consistency" sub="last 30d" />
        <StatCard value={`${Math.round((consistency.study_days_last_30d / 30) * 100)}%`} label="Study consistency" sub="last 30d" />
      </div>
    </section>
  )
}

export function EfficiencySection({stats, activeMinutes}: {stats: StatsResponse; activeMinutes: number}) {
  const efficiency = stats.efficiency_summary
  return (
    <section className="stats-section">
      <SectionTitle icon="🚀" subtitle="Progress relative to active foreground study time">
        Study efficiency
      </SectionTitle>
      <div className="stats-cards stats-cards-6">
        <StatCard value={formatRate(efficiency.reviews_per_active_minute)} label="Reviews / minute" sub={`${efficiency.total_review_events.toLocaleString()} review events`} />
        <StatCard value={formatRate(efficiency.improved_events_per_active_minute)} label="Improved / minute" />
        <StatCard value={formatRate(efficiency.net_events_per_active_minute)} label="Net / minute" />
        <StatCard value={efficiency.reviewed_words_per_session.toFixed(1)} label="Reviewed / session" />
        <StatCard value={efficiency.improved_words_per_session.toFixed(1)} label="Improved / session" />
        <StatCard value={activeMinutes.toLocaleString()} label="Active minutes" />
      </div>
      <div className="stats-tracking-note">
        These are derived from active foreground time and review events. Idle time is excluded.
      </div>
    </section>
  )
}

export function QueueQualitySection({stats}: {stats: StatsResponse}) {
  const queue = stats.queue_summary
  const rows = [
    {label: 'Queues completed', val: queue.completed_queues, color: '#10b981'},
    {label: 'Queues still active', val: queue.active_queues, color: '#2563eb'},
    {label: 'Queues not completed', val: Math.max(0, queue.total_queues - queue.completed_queues), color: '#f97316'},
  ]
  return (
    <section className="stats-section">
      <SectionTitle icon="🧺" subtitle="Completion rate, size, and speed for smart-review queues">
        Queue quality
      </SectionTitle>
      <div className="stats-cards stats-cards-6">
        <StatCard value={queue.total_queues} label="Queues" />
        <StatCard value={queue.completed_queues} label="Completed" />
        <StatCard value={`${queue.completion_rate_pct}%`} label="Completion rate" />
        <StatCard value={queue.avg_queue_size} label="Avg queue size" />
        <StatCard value={`${queue.avg_completion_ratio_pct}%`} label="Avg completion" />
        <StatCard value={formatDuration(queue.avg_completion_seconds)} label="Avg completion time" />
      </div>
      <QualityBars rows={rows} total={queue.total_queues} />
      <div className="stats-tracking-note">
        Queue quality is based on generated study queues, completion count, and completion time.
      </div>
    </section>
  )
}

export function KnowledgeDistributionSection({stats, totalWords}: {stats: StatsResponse; totalWords: number}) {
  const slices = LEVEL_KEYS
    .map((key) => ({
      value: key === 'unset' ? stats.level_counts.unset : stats.level_counts[key],
      color: LEVEL_COLORS[key],
      label: LEVEL_LABELS[key],
    }))
    .filter((slice) => slice.value > 0)
  return (
    <section className="stats-section">
      <SectionTitle icon="🧱" subtitle="How your library is distributed across knowledge levels">
        Knowledge distribution
      </SectionTitle>
      {totalWords > 0 ? (
        <div className="stats-donut-row">
          <DonutChart slices={slices} centerLabel={totalWords.toLocaleString()} centerSub="words" size={150} />
          <div className="stats-dist-detail">
            <div className="stats-dist-bar" aria-label="Knowledge level distribution">
              {LEVEL_KEYS.map((key) => {
                const count = key === 'unset' ? stats.level_counts.unset : stats.level_counts[key]
                if (count === 0) return null
                return (
                  <div
                    key={key}
                    className="stats-dist-segment"
                    style={{width: `${(count / totalWords) * 100}%`, background: LEVEL_COLORS[key]}}
                    title={`${LEVEL_LABELS[key]}: ${count}`}
                  />
                )
              })}
            </div>
            <div className="stats-dist-legend">
              {LEVEL_KEYS.map((key) => {
                const count = key === 'unset' ? stats.level_counts.unset : stats.level_counts[key]
                if (count === 0) return null
                return (
                  <div key={key} className="stats-legend-item">
                    <span className="stats-legend-dot" style={{background: LEVEL_COLORS[key]}} />
                    <span className="stats-legend-label">{LEVEL_LABELS[key]}</span>
                    <span className="stats-legend-count">{count.toLocaleString()}</span>
                    <span className="stats-legend-pct">({Math.round((count / totalWords) * 100)}%)</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : <div className="stats-empty">No words yet.</div>}
    </section>
  )
}

export function DailyProgressSection({
  stats,
  activityPeriod,
  onActivityPeriodChange,
  activityTotals,
  filteredActivity,
  activityChartData,
  bestDay,
  worstDay,
}: {
  stats: StatsResponse
  activityPeriod: ActivityPeriod
  onActivityPeriodChange: (value: ActivityPeriod) => void
  activityTotals: {reviewed: number; improved: number; downgraded: number; net: number}
  filteredActivity: DailyActivity[]
  activityChartData: {label: string; value: number}[]
  bestDay: DailyActivity | null
  worstDay: DailyActivity | null
}) {
  return (
    <section className="stats-section">
      <div className="stats-section-header">
        <SectionTitle icon="📈" subtitle="Recent improvement, setbacks, and net movement">
          Daily progress
        </SectionTitle>
        <PeriodTabs options={ACTIVITY_PERIODS} value={activityPeriod} onChange={onActivityPeriodChange} />
      </div>
      <div className="stats-cards stats-cards-4">
        <StatCard value={activityTotals.reviewed} label="Level changes" />
        <StatCard value={activityTotals.improved} label="Improved" />
        <StatCard value={activityTotals.downgraded} label="Downgraded" />
        <StatCard value={activityTotals.net >= 0 ? `+${activityTotals.net}` : String(activityTotals.net)} label="Net progress" />
      </div>
      {bestDay && (
        <div className="stats-highlight-row">
          <span className="stats-highlight">🏆 Best day: <strong>{dayLabel(bestDay.date)}</strong> - +{bestDay.net} net, {bestDay.improved} improved</span>
          {worstDay && <span className="stats-highlight">📉 Most setbacks: <strong>{dayLabel(worstDay.date)}</strong> - {worstDay.downgraded} downgraded</span>}
        </div>
      )}
      {activityChartData.length > 0
        ? <BarChart data={activityChartData} color="#10b981" />
        : <div className="stats-empty">No level changes recorded for this period. Start studying to see progress here.</div>}
      {stats.tracking_started_at && (
        <div className="stats-tracking-note">
          Progress tracking started {dayLabel(stats.tracking_started_at)}. Earlier history is not available.
        </div>
      )}
      {filteredActivity.length > 0 && <DailyBreakdownTable days={filteredActivity} />}
    </section>
  )
}

export function WordsAddedSection({
  monthPeriod,
  onMonthPeriodChange,
  monthChartData,
}: {
  monthPeriod: MonthPeriod
  onMonthPeriodChange: (value: MonthPeriod) => void
  monthChartData: {label: string; value: number}[]
}) {
  return (
    <section className="stats-section">
      <div className="stats-section-header">
        <SectionTitle icon="🗓️" subtitle="How quickly your vocabulary library is growing">
          Words added by month
        </SectionTitle>
        <PeriodTabs options={MONTH_PERIODS} value={monthPeriod} onChange={onMonthPeriodChange} />
      </div>
      {monthChartData.length > 0 ? <BarChart data={monthChartData} /> : <div className="stats-empty">No data for this period.</div>}
    </section>
  )
}

export function TopicsSection({
  topics,
  topicSort,
  onTopicSortChange,
  topicExpanded,
  onTopicExpandedChange,
}: {
  topics: TopicStat[]
  topicSort: TopicSort
  onTopicSortChange: (value: TopicSort) => void
  topicExpanded: boolean
  onTopicExpandedChange: (value: boolean) => void
}) {
  const navigate = useNavigate()
  return (
    <section className="stats-section">
      <div className="stats-section-header">
        <SectionTitle icon="🧭" subtitle="Which topics are strongest, weakest, and most neglected">
          Topics
        </SectionTitle>
        <PeriodTabs options={TOPIC_SORT_OPTIONS} value={topicSort} onChange={onTopicSortChange} />
      </div>
      {topics.length === 0 ? <div className="stats-empty">No topics with words yet.</div> : (
        <>
          <div className="stats-topic-table">
            <div className="stats-topic-header">
              <span>Topic</span>
              <span className="stats-col-center stats-topic-count">Words</span>
              <span className="stats-col-center stats-topic-weak">Weak</span>
              <span className="stats-col-center stats-topic-missing">Need 3+</span>
              <span className="stats-col-right">Progress</span>
            </div>
            {(topicExpanded ? topics : topics.slice(0, 10)).map((row) => (
              <div key={row.id} className="stats-topic-row" onClick={() => navigate(routes.topic(row.slug))}>
                <span className="stats-topic-name">{row.name}</span>
                <span className="stats-col-center stats-topic-count">{row.total}</span>
                <span className={`stats-col-center stats-topic-weak ${row.weak_count > 0 ? 'has-weak' : ''}`}>{row.weak_count > 0 ? row.weak_count : '—'}</span>
                <span className={`stats-col-center stats-topic-missing ${row.needs_example_enrichment > 0 ? 'has-missing' : ''}`}>{row.needs_example_enrichment > 0 ? row.needs_example_enrichment : '—'}</span>
                <div className="stats-topic-progress-wrap">
                  <span className="stats-topic-pct">{row.progress}%</span>
                  <div className="stats-topic-bar"><div className="stats-topic-bar-fill" style={{width: `${row.progress}%`}} /></div>
                </div>
              </div>
            ))}
          </div>
          {topics.length > 10 && (
            <button type="button" className="stats-show-more" onClick={() => onTopicExpandedChange(!topicExpanded)}>
              {topicExpanded ? 'Show less' : `Show all ${topics.length} topics`}
            </button>
          )}
        </>
      )}
    </section>
  )
}

export function DataQualitySection({stats, totalWords}: {stats: StatsResponse; totalWords: number}) {
  const overview = stats.overview
  const enrichComplete = totalWords - overview.needs_example_enrichment
  const enrichSlices = [
    {value: enrichComplete, color: '#10b981', label: 'Complete'},
    {value: overview.needs_example_enrichment, color: '#f97316', label: 'Needs 3+ examples'},
  ].filter((slice) => slice.value > 0)
  const rows = [
    {label: 'Any example', val: overview.with_example, color: '#10b981'},
    {label: '3+ examples', val: overview.with_examples_3plus, color: '#f59e0b'},
    {label: 'POS coverage', val: overview.with_pos, color: '#6366f1'},
  ]
  return (
    <section className="stats-section">
      <SectionTitle icon="🧪" subtitle="Coverage of examples, parts of speech, and missing fields">
        Data quality
      </SectionTitle>
      <div className="stats-donut-row">
        <DonutChart slices={enrichSlices} centerLabel={`${Math.round((enrichComplete / Math.max(1, totalWords)) * 100)}%`} centerSub="complete" size={130} />
        <div className="stats-quality-detail">
          <div className="stats-cards stats-cards-2">
            <StatCard value={overview.with_examples_3plus} label="3+ examples" />
            <StatCard value={overview.needs_example_enrichment} label="Need 3+ examples" />
            <StatCard value={overview.missing_pos} label="Missing POS" />
            <StatCard value={stats.level_counts.unset} label="No level set" />
          </div>
          <QualityBars rows={rows} total={totalWords} />
        </div>
      </div>
    </section>
  )
}

function DailyBreakdownTable({days}: {days: DailyActivity[]}) {
  return (
    <details className="stats-daily-details">
      <summary className="stats-daily-summary">Show daily breakdown ({days.length} days)</summary>
      <div className="stats-daily-table">
        <div className="stats-daily-header">
          <span>Date</span>
          <span className="stats-col-center">Changed</span>
          <span className="stats-col-center">Improved</span>
          <span className="stats-col-center">Downgraded</span>
          <span className="stats-col-right">Net</span>
        </div>
        {days.map((day) => (
          <div key={day.date} className="stats-daily-row">
            <span className="stats-daily-date">{day.date}</span>
            <span className="stats-col-center">{day.reviewed}</span>
            <span className="stats-col-center stats-improved">{day.improved > 0 ? `+${day.improved}` : '—'}</span>
            <span className="stats-col-center stats-downgraded">{day.downgraded > 0 ? `-${day.downgraded}` : '—'}</span>
            <span className={`stats-col-right stats-net ${day.net > 0 ? 'stats-net-pos' : day.net < 0 ? 'stats-net-neg' : ''}`}>
              {day.net > 0 ? `+${day.net}` : day.net === 0 ? '0' : day.net}
            </span>
          </div>
        ))}
      </div>
    </details>
  )
}
