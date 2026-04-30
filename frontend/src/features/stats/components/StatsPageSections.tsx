import type {StatsResponse} from '@/features/stats/api/statsApi'
import {BarChart, PeriodTabs, SectionTitle, StatCard} from '@/features/stats/components/StatsComponents'
import {
  ACTIVITY_PERIODS,
  formatDuration,
  formatRate,
  type ActivityPeriod,
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
        <SectionTitle>App time</SectionTitle>
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
      <SectionTitle>Retention quality</SectionTitle>
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
      <SectionTitle>Consistency</SectionTitle>
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
      <SectionTitle>Study efficiency</SectionTitle>
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
      <SectionTitle>Queue quality</SectionTitle>
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

function QualityBars({
  rows,
  total,
}: {
  rows: {label: string; val: number; color: string}[]
  total: number
}) {
  return (
    <div className="stats-quality-row">
      {rows.map(({label, val, color}) => (
        <div key={label} className="stats-quality-item">
          <span className="stats-quality-label">{label}</span>
          <div className="stats-quality-bar-wrap">
            <div className="stats-quality-bar" style={{width: `${Math.round((val / Math.max(1, total)) * 100)}%`, background: color}} />
          </div>
          <span className="stats-quality-pct">{Math.round((val / Math.max(1, total)) * 100)}%</span>
        </div>
      ))}
    </div>
  )
}
