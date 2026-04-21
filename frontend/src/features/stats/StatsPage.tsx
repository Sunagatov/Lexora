import {useMemo, useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {useQuery} from '@tanstack/react-query'
import {fetchStats} from './api'
import type {DailyActivity, TopicStat} from './api'
import {DonutChart, BarChart, StatCard, SectionTitle, PeriodTabs} from './StatsComponents'
import {InsightsStrip} from './StatsInsights'
import {queryKeys} from '../../shared/queryKeys'
import {routes} from '../../shared/routes'

const LEVEL_LABELS: Record<string, string> = {
  level_1: 'Weak', level_2: 'Basic', level_3: 'Okay', level_4: 'Strong', level_5: 'Parked', unset: 'No level',
}
const LEVEL_COLORS: Record<string, string> = {
  level_1: '#dc2626', level_2: '#2563eb', level_3: '#7c3aed', level_4: '#059669', level_5: '#cbd5e1', unset: '#e2e8f0',
}
const LEVEL_KEYS = ['level_1', 'level_2', 'level_3', 'level_4', 'level_5', 'unset'] as const

type ActivityPeriod = 'all' | '365' | '90' | '30' | '7'
const ACTIVITY_PERIODS: {value: ActivityPeriod; label: string}[] = [
  {value: '7', label: '7 days'}, {value: '30', label: '30 days'},
  {value: '90', label: '90 days'}, {value: '365', label: '1 year'}, {value: 'all', label: 'All time'},
]

type MonthPeriod = 'all' | '12' | '6' | '3' | '1'
const MONTH_PERIODS: {value: MonthPeriod; label: string}[] = [
  {value: '1', label: '1 month'}, {value: '3', label: '3 months'},
  {value: '6', label: '6 months'}, {value: '12', label: '12 months'}, {value: 'all', label: 'All time'},
]

type TopicSort = 'worst' | 'best' | 'largest' | 'weakest'

export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function filterByDays<T extends {date: string}>(days: T[], period: ActivityPeriod): T[] {
  if (period === 'all') return days
  const windowSize = Number(period)
  const cutoff = new Date()
  cutoff.setHours(0, 0, 0, 0)
  cutoff.setDate(cutoff.getDate() - (windowSize - 1))
  const cutoffKey = toLocalDateKey(cutoff)
  return days.filter((d) => d.date >= cutoffKey)
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0s'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`
  if (minutes > 0) return `${minutes}m ${remainder > 0 ? `${remainder}s` : ''}`.trim()
  return `${remainder}s`
}

function filterByMonths(entries: [string, number][], period: MonthPeriod): [string, number][] {
  if (period === 'all') return entries
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - Number(period) + 1)
  cutoff.setDate(1)
  const key = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}`
  return entries.filter(([k]) => k >= key)
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-')
  return `${new Date(Number(y), Number(m) - 1, 1).toLocaleString('default', {month: 'short'})} '${y.slice(2)}`
}

function dayLabel(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('default', {month: 'short', day: 'numeric'})
}

export function StatsPage() {
  const navigate   = useNavigate()
  const {data: s, isLoading} = useQuery({queryKey: queryKeys.stats, queryFn: fetchStats})

  const [activityPeriod, setActivityPeriod] = useState<ActivityPeriod>('30')
  const [usagePeriod,    setUsagePeriod]    = useState<ActivityPeriod>('30')
  const [monthPeriod,    setMonthPeriod]    = useState<MonthPeriod>('all')
  const [topicSort,      setTopicSort]      = useState<TopicSort>('worst')
  const [topicExpanded,  setTopicExpanded]  = useState(false)

  const filteredActivity = useMemo(
    () => s ? filterByDays(s.daily_activity, activityPeriod) : [],
    [s, activityPeriod],
  )
  const filteredUsage = useMemo(
    () => s ? filterByDays(s.usage_daily, usagePeriod) : [],
    [s, usagePeriod],
  )
  const activityTotals = useMemo(() => {
    let reviewed = 0, improved = 0, downgraded = 0, net = 0
    for (const d of filteredActivity) { reviewed += d.reviewed; improved += d.improved; downgraded += d.downgraded; net += d.net }
    return {reviewed, improved, downgraded, net}
  }, [filteredActivity])
  const usageTotals = s?.usage_summary

  const activityChartData = useMemo(() =>
    [...filteredActivity].reverse().slice(-60).map((d) => ({label: dayLabel(d.date), value: d.net})),
    [filteredActivity],
  )
  const usageChartData = useMemo(() =>
    [...filteredUsage].reverse().slice(-60).map((d) => ({label: dayLabel(d.date), value: d.active_seconds})),
    [filteredUsage],
  )
  const monthChartData = useMemo(() => {
    if (!s) return []
    const entries = Object.entries(s.words_added_by_month).sort(([a], [b]) => a.localeCompare(b))
    return filterByMonths(entries, monthPeriod).map(([k, v]) => ({label: monthLabel(k), value: v}))
  }, [s, monthPeriod])

  const sortedTopics = useMemo((): TopicStat[] => {
    if (!s) return []
    const t = [...s.topics]
    switch (topicSort) {
      case 'worst':   return t.sort((a, b) => a.progress - b.progress)
      case 'best':    return t.sort((a, b) => b.progress - a.progress)
      case 'largest': return t.sort((a, b) => b.total - a.total)
      case 'weakest': return t.sort((a, b) => b.weak_count - a.weak_count)
    }
  }, [s, topicSort])

  const bestDay  = useMemo(() => filteredActivity.reduce((b, d) => d.net > (b?.net ?? -Infinity) ? d : b, null as DailyActivity | null), [filteredActivity])
  const worstDay = useMemo(() => filteredActivity.filter((d) => d.downgraded > 0).reduce((w, d) => d.downgraded > (w?.downgraded ?? -Infinity) ? d : w, null as DailyActivity | null), [filteredActivity])

  if (isLoading) return <div className="stats-loading">Loading…</div>
  if (!s) return <div className="stats-loading">Failed to load statistics.</div>

  const ov = s.overview
  const totalWords = ov.total_words
  const knowledgeSlices = LEVEL_KEYS
    .map((k) => ({value: k === 'unset' ? s.level_counts.unset : s.level_counts[k], color: LEVEL_COLORS[k], label: LEVEL_LABELS[k]}))
    .filter((sl) => sl.value > 0)
  const enrichComplete = totalWords - ov.needs_example_enrichment
  const enrichSlices = [
    {value: enrichComplete, color: '#10b981', label: 'Complete'},
    {value: ov.needs_example_enrichment, color: '#f97316', label: 'Needs 3+ examples'},
  ].filter((sl) => sl.value > 0)

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

        <InsightsStrip s={s} />

        <section className="stats-section">
          <SectionTitle>Vocabulary overview</SectionTitle>
          <div className="stats-cards stats-cards-4">
            <StatCard value={ov.total_words}  label="Total words" />
            <StatCard value={ov.total_topics} label="Topics" />
            <StatCard value={s.level_counts.level_4} label="Strong (lvl 4)" />
            <StatCard value={`${s.okay_or_better_pct}%`} label="Okay or better" />
          </div>
        </section>

        <section className="stats-section">
          <div className="stats-section-header">
            <SectionTitle>App time</SectionTitle>
            <PeriodTabs options={ACTIVITY_PERIODS} value={usagePeriod} onChange={setUsagePeriod} />
          </div>
          {usageTotals ? (
            <>
              <div className="stats-cards stats-cards-4">
                <StatCard value={formatDuration(usageTotals.total_active_seconds)} label="Active time" sub={`${usageTotals.active_days.toLocaleString()} active days`} />
                <StatCard value={formatDuration(usageTotals.today_active_seconds)} label="Today" />
                <StatCard value={formatDuration(usageTotals.last_7d_active_seconds)} label="This week" />
                <StatCard value={usageTotals.sessions.toLocaleString()} label="Sessions" />
              </div>
              <div className="stats-cards stats-cards-2">
                <StatCard value={formatDuration(usageTotals.avg_session_seconds)} label="Avg session" />
                <StatCard value={formatDuration(usageTotals.longest_session_seconds)} label="Longest session" />
              </div>
              {usageChartData.length > 0
                ? <BarChart data={usageChartData} color="#2563eb" formatValue={formatDuration} />
                : <div className="stats-empty">No app activity recorded for this period.</div>
              }
              {s.usage_started_at && (
                <div className="stats-tracking-note">
                  Active time tracking started {dayLabel(s.usage_started_at)}. Idle time is excluded.
                </div>
              )}
            </>
          ) : <div className="stats-empty">No app activity recorded yet.</div>}
        </section>

        <section className="stats-section">
          <SectionTitle>Knowledge distribution</SectionTitle>
          {totalWords > 0 ? (
            <div className="stats-donut-row">
              <DonutChart slices={knowledgeSlices} centerLabel={totalWords.toLocaleString()} centerSub="words" size={150} />
              <div className="stats-dist-legend">
                {LEVEL_KEYS.map((k) => {
                  const count = k === 'unset' ? s.level_counts.unset : s.level_counts[k]
                  if (count === 0) return null
                  return (
                    <div key={k} className="stats-legend-item">
                      <span className="stats-legend-dot" style={{background: LEVEL_COLORS[k]}} />
                      <span className="stats-legend-label">{LEVEL_LABELS[k]}</span>
                      <span className="stats-legend-count">{count.toLocaleString()}</span>
                      <span className="stats-legend-pct">({Math.round((count / totalWords) * 100)}%)</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : <div className="stats-empty">No words yet.</div>}
        </section>

        <section className="stats-section">
          <div className="stats-section-header">
            <SectionTitle>Daily progress</SectionTitle>
            <PeriodTabs options={ACTIVITY_PERIODS} value={activityPeriod} onChange={setActivityPeriod} />
          </div>
          <div className="stats-cards stats-cards-4">
            <StatCard value={activityTotals.reviewed}   label="Level changes" />
            <StatCard value={activityTotals.improved}   label="Improved" />
            <StatCard value={activityTotals.downgraded} label="Downgraded" />
            <StatCard value={activityTotals.net >= 0 ? `+${activityTotals.net}` : String(activityTotals.net)} label="Net progress" />
          </div>
          {bestDay && (
            <div className="stats-highlight-row">
              <span className="stats-highlight">🏆 Best day: <strong>{dayLabel(bestDay.date)}</strong> — +{bestDay.net} net, {bestDay.improved} improved</span>
              {worstDay && <span className="stats-highlight">📉 Most setbacks: <strong>{dayLabel(worstDay.date)}</strong> — {worstDay.downgraded} downgraded</span>}
            </div>
          )}
          {activityChartData.length > 0
            ? <BarChart data={activityChartData} color="#10b981" />
            : <div className="stats-empty">No level changes recorded for this period. Start studying to see progress here.</div>
          }
          {s.tracking_started_at && (
            <div className="stats-tracking-note">
              Progress tracking started {dayLabel(s.tracking_started_at)}. Earlier history is not available.
            </div>
          )}
          {filteredActivity.length > 0 && (
            <details className="stats-daily-details">
              <summary className="stats-daily-summary">Show daily breakdown ({filteredActivity.length} days)</summary>
              <div className="stats-daily-table">
                <div className="stats-daily-header">
                  <span>Date</span>
                  <span className="stats-col-center">Changed</span>
                  <span className="stats-col-center">Improved</span>
                  <span className="stats-col-center">Downgraded</span>
                  <span className="stats-col-right">Net</span>
                </div>
                {filteredActivity.map((d) => (
                  <div key={d.date} className="stats-daily-row">
                    <span className="stats-daily-date">{d.date}</span>
                    <span className="stats-col-center">{d.reviewed}</span>
                    <span className="stats-col-center stats-improved">{d.improved > 0 ? `+${d.improved}` : '—'}</span>
                    <span className="stats-col-center stats-downgraded">{d.downgraded > 0 ? `-${d.downgraded}` : '—'}</span>
                    <span className={`stats-col-right stats-net ${d.net > 0 ? 'stats-net-pos' : d.net < 0 ? 'stats-net-neg' : ''}`}>
                      {d.net > 0 ? `+${d.net}` : d.net === 0 ? '0' : d.net}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>

        <section className="stats-section">
          <div className="stats-section-header">
            <SectionTitle>Words added by month</SectionTitle>
            <PeriodTabs options={MONTH_PERIODS} value={monthPeriod} onChange={setMonthPeriod} />
          </div>
          {monthChartData.length > 0
            ? <BarChart data={monthChartData} />
            : <div className="stats-empty">No data for this period.</div>
          }
        </section>

        <section className="stats-section">
          <div className="stats-section-header">
            <SectionTitle>Topics</SectionTitle>
            <PeriodTabs
              options={(['worst','best','largest','weakest'] as TopicSort[]).map((v) => ({
                value: v, label: v === 'worst' ? 'Worst first' : v === 'best' ? 'Best first' : v === 'largest' ? 'Largest' : 'Most weak',
              }))}
              value={topicSort}
              onChange={setTopicSort}
            />
          </div>
          {sortedTopics.length === 0 ? <div className="stats-empty">No topics with words yet.</div> : (
            <>
              <div className="stats-topic-table">
                <div className="stats-topic-header">
                  <span>Topic</span>
                  <span className="stats-col-center stats-topic-count">Words</span>
                  <span className="stats-col-center stats-topic-weak">Weak</span>
                  <span className="stats-col-center stats-topic-missing">Need 3+</span>
                  <span className="stats-col-right">Progress</span>
                </div>
                {(topicExpanded ? sortedTopics : sortedTopics.slice(0, 10)).map((row) => (
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
              {sortedTopics.length > 10 && (
                <button type="button" className="stats-show-more" onClick={() => setTopicExpanded((v) => !v)}>
                  {topicExpanded ? 'Show less' : `Show all ${sortedTopics.length} topics`}
                </button>
              )}
            </>
          )}
        </section>

        <section className="stats-section">
          <SectionTitle>Data quality</SectionTitle>
          <div className="stats-donut-row">
            <DonutChart slices={enrichSlices} centerLabel={`${Math.round((enrichComplete / Math.max(1, totalWords)) * 100)}%`} centerSub="complete" size={130} />
            <div className="stats-quality-detail">
          <div className="stats-cards stats-cards-2">
                <StatCard value={ov.with_examples_3plus} label="3+ examples" />
                <StatCard value={ov.needs_example_enrichment} label="Need 3+ examples" />
                <StatCard value={ov.missing_pos}     label="Missing POS" />
                <StatCard value={s.level_counts.unset} label="No level set" />
              </div>
              <div className="stats-quality-row">
                {[
                  {label: 'Any example',       val: ov.with_example, color: '#10b981'},
                  {label: '3+ examples',       val: ov.with_examples_3plus, color: '#f59e0b'},
                  {label: 'POS coverage',     val: ov.with_pos,     color: '#6366f1'},
                ].map(({label, val, color}) => (
                  <div key={label} className="stats-quality-item">
                    <span className="stats-quality-label">{label}</span>
                    <div className="stats-quality-bar-wrap">
                      <div className="stats-quality-bar" style={{width: `${Math.round((val / Math.max(1, totalWords)) * 100)}%`, background: color}} />
                    </div>
                    <span className="stats-quality-pct">{Math.round((val / Math.max(1, totalWords)) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}
