import {useState, useSyncExternalStore, type ReactNode} from 'react'
import {useQuery} from '@tanstack/react-query'
import {useNavigate} from 'react-router-dom'
import {routes} from '@/app/routes'
import {queryKeys} from '@/app/queryKeys'
import {languagePreferences, subscribeLanguages} from '@/features/languages/api'
import {offlineStatus, subscribeOffline} from '@/features/offline/offline'
import {readMixProgress} from '@/features/offline/storage'
import type {DailyActivity, LearningStatsResponse, LearningTopicStat, LibraryStatsResponse, LibraryTopicStat} from '@/features/stats/types/statsTypes'
import {BarChart, DonutChart, PeriodTabs, QualityBars, SectionTitle, StatCard} from '@/features/stats/components/StatsComponents'
import {
  ACTIVITY_PERIODS,
  LEVEL_COLORS,
  LEVEL_KEYS,
  LEVEL_LABELS,
  MONTH_PERIODS,
  dayLabel,
  formatDuration,
  type ActivityPeriod,
  type MonthPeriod,
} from '@/features/stats/model/statsPageModel'

export function AppTimeSection({
  stats,
  usagePeriod,
  onUsagePeriodChange,
  usageChartData,
  periodUsage,
}: {
  stats: LearningStatsResponse
  usagePeriod: ActivityPeriod
  onUsagePeriodChange: (value: ActivityPeriod) => void
  usageChartData: {label: string; value: number}[]
  periodUsage: {seconds: number; days: number}
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
      <div className="stats-cards stats-cards-2">
        <StatCard value={formatDuration(periodUsage.seconds)} label="Active time" />
        <StatCard value={periodUsage.days.toLocaleString()} label="Active days" />
      </div>
      {usageChartData.length > 0
        ? <BarChart data={usageChartData} color="#2563eb" formatValue={formatDuration} />
        : <div className="stats-empty">No app activity recorded for this period.</div>}
      {stats.usage_started_at && (
        <div className="stats-tracking-note">
          Recorded since {dayLabel(stats.usage_started_at)}. All time: {usage.sessions.toLocaleString()} sessions,
          {' '}{formatDuration(usage.avg_session_seconds)} average, {formatDuration(usage.longest_session_seconds)} longest.
        </div>
      )}
    </section>
  )
}

export function ReviewHistorySection({history}: {history: LearningStatsResponse['review_history']}) {
  return (
    <section className="stats-section">
      <SectionTitle icon="🛡️" subtitle="All-time activity. A word can appear in both rating-change counts.">
        Review history
      </SectionTitle>
      <div className="stats-cards stats-cards-3">
        <StatCard value={history.reviewed_words} label="Reviewed words" />
        <StatCard value={history.improved_words} label="Ever moved up" />
        <StatCard value={history.regressed_words} label="Ever moved down" />
      </div>
    </section>
  )
}

export function ConsistencySection({stats}: {stats: LearningStatsResponse}) {
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

export function DailyMixActivitySection({stats}: {stats: LearningStatsResponse}) {
  const mix = stats.mix_activity
  const {saved} = useSyncExternalStore(subscribeOffline, offlineStatus)
  const {language} = useSyncExternalStore(subscribeLanguages, languagePreferences)
  const {data: deviceMix} = useQuery({
    queryKey: [...queryKeys.stats, 'device-mix', language],
    queryFn: () => readMixProgress(language),
    enabled: saved,
  })
  return (
    <section className="stats-section">
      <SectionTitle icon="🧺" subtitle="Sets recorded on the server">Daily Mix activity</SectionTitle>
      {mix.started > 0 ? <div className="stats-cards stats-cards-6">
        <StatCard value={mix.started} label="Started" />
        <StatCard value={mix.completed} label="Completed" />
        <StatCard value={mix.in_progress} label="In progress" />
        <StatCard value={mix.unfinished} label="Ended unfinished" />
        <StatCard value={mix.completion_rate_pct === null ? '—' : `${mix.completion_rate_pct}%`} label="Completion rate" sub="Finished or expired sets" />
        <StatCard value={mix.avg_completion_span_seconds === null ? '—' : formatDuration(mix.avg_completion_span_seconds)}
          label="Avg completion span" sub="First to last recorded item" />
      </div> : <div className="stats-empty">No started sets recorded on the server yet.</div>}
      {saved && deviceMix && deviceMix.total > 0 && (
        <div className="stats-tracking-note">
          Current mix on this device · {deviceMix.completed.toLocaleString()} of {deviceMix.total.toLocaleString()} words completed.
        </div>
      )}
    </section>
  )
}

export function KnowledgeDistributionSection({stats}: {stats: LearningStatsResponse}) {
  const levels = LEVEL_KEYS.map((key) => ({
    key,
    value: stats.level_counts[key],
    color: LEVEL_COLORS[key],
    label: LEVEL_LABELS[key],
  }))
  const ratedLevels = levels.filter(({key}) => key !== 'level_5' && key !== 'unset')
  const totalWords = levels.reduce((sum, level) => sum + level.value, 0)
  return (
    <section className="stats-section">
      <SectionTitle icon="🧱" subtitle="Okay or better is the share of Weak, Okay, and Strong words rated Okay or Strong">
        Current knowledge
      </SectionTitle>
      {totalWords > 0 ? (
        <div className="stats-donut-row">
          <DonutChart slices={ratedLevels} centerLabel={`${stats.okay_or_better_pct}%`} centerSub={['Okay or', 'better']} size={150} />
          <div className="stats-dist-detail">
            <div className="stats-dist-bar" aria-label="Knowledge level distribution">
              {levels.filter((level) => level.value > 0).map((level) => (
                  <div
                    key={level.label}
                    className="stats-dist-segment"
                    style={{width: `${(level.value / totalWords) * 100}%`, background: level.color}}
                    title={`${level.label}: ${level.value}`}
                  />
              ))}
            </div>
            <div className="stats-dist-legend">
              {levels.map((level) => (
                  <div key={level.label} className="stats-legend-item">
                    <span className="stats-legend-dot" style={{background: level.color}} />
                    <span className="stats-legend-label">{level.label}</span>
                    <span className="stats-legend-count">{level.value.toLocaleString()}</span>
                  </div>
              ))}
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
  filteredActivity,
  activityChartData,
  bestDay,
  worstDay,
}: {
  stats: LearningStatsResponse
  activityPeriod: ActivityPeriod
  onActivityPeriodChange: (value: ActivityPeriod) => void
  filteredActivity: DailyActivity[]
  activityChartData: {label: string; value: number}[]
  bestDay: DailyActivity | null
  worstDay: DailyActivity | null
}) {
  const period = stats.review_periods[activityPeriod]
  return (
    <section className="stats-section">
      <div className="stats-section-header">
        <SectionTitle icon="📈" subtitle="Practice ratings grouped by UTC day">
          Review activity
        </SectionTitle>
        <PeriodTabs options={ACTIVITY_PERIODS} value={activityPeriod} onChange={onActivityPeriodChange} />
      </div>
      <div className="stats-cards stats-cards-4">
        <StatCard value={period.unique_words} label="Unique words reviewed" />
        <StatCard value={period.attempts} label="Review attempts" />
        <StatCard value={period.first_reviews} label="First reviews" />
        <StatCard value={period.repeat_reviews} label="Revisits" />
        <StatCard value={period.improved_words} label="Words moved up" sub="Net rating changes" />
        <StatCard value={period.regressed_words} label="Words moved down" sub="Net rating changes" />
        <StatCard value={period.study_days} label="Study days" />
      </div>
      {bestDay && (
        <div className="stats-highlight-row">
          <span className="stats-highlight">🏆 Best day: <strong>{dayLabel(bestDay.date)}</strong> - {bestDay.net > 0 ? '+' : ''}{bestDay.net} net, {bestDay.improved} improved</span>
          {worstDay && <span className="stats-highlight">📉 Most setbacks: <strong>{dayLabel(worstDay.date)}</strong> - {worstDay.downgraded} downgraded</span>}
        </div>
      )}
      {activityChartData.length > 0
        ? <><h4>Rating increases minus decreases</h4><BarChart data={activityChartData} color="#10b981" /></>
        : <div className="stats-empty">No reviews recorded for this period. Start studying to see progress here.</div>}
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
        <SectionTitle icon="🗓️" subtitle="Active words, including imports, grouped by their saved creation date">
          Current library by month added
        </SectionTitle>
        <PeriodTabs options={MONTH_PERIODS} value={monthPeriod} onChange={onMonthPeriodChange} />
      </div>
      {monthChartData.length > 0 ? <BarChart data={monthChartData} /> : <div className="stats-empty">No data for this period.</div>}
    </section>
  )
}

export function TopicsSection<T extends LearningTopicStat | LibraryTopicStat>({
  topics, title, subtitle, empty, controls, columns,
}: {
  topics: T[]
  title: string
  subtitle: string
  empty: string
  controls: ReactNode
  columns: {label: string; value: (topic: T) => number}[]
}) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  return (
    <section className="stats-section">
      <div className="stats-section-header">
        <SectionTitle icon="🧭" subtitle={subtitle}>{title}</SectionTitle>
        {controls}
      </div>
      {topics.length === 0 ? <div className="stats-empty">{empty}</div> : (
        <>
          <div className="stats-topic-table">
            <div className="stats-topic-header">
              <span>Topic</span>
              {columns.map(({label}) => <span key={label} className="stats-col-center">{label}</span>)}
            </div>
            {(expanded ? topics : topics.slice(0, 10)).map((row) => (
              <button type="button" key={row.id} className="stats-topic-row" onClick={() => navigate(routes.topic(row.slug))}
                aria-label={[row.name, ...columns.map(({label, value}) => `${label} ${value(row).toLocaleString()}`)].join(', ')}>
                <span className="stats-topic-name">{row.name}</span>
                {columns.map(({label, value}) => (
                  <span key={label} className="stats-col-center stats-topic-count">
                    {value(row).toLocaleString()}
                  </span>
                ))}
              </button>
            ))}
          </div>
          {topics.length > 10 && (
            <button type="button" className="stats-show-more" onClick={() => setExpanded(!expanded)}>
              {expanded ? 'Show less' : `Show all ${topics.length} topics`}
            </button>
          )}
        </>
      )}
    </section>
  )
}

export function DataQualitySection({overview}: {overview: LibraryStatsResponse['overview']}) {
  const totalWords = overview.total_words
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
            <StatCard value={overview.missing_example} label="No examples" />
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
