import {useMemo, useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {useQuery} from '@tanstack/react-query'
import {fetchStats} from './api'
import type {DailyActivity, StatsResponse, TopicStat} from './api'

// ── constants ─────────────────────────────────────────────────────────────────

const LEVEL_LABELS: Record<string, string> = {
  level_1: 'Weak', level_2: 'Basic', level_3: 'Okay', level_4: 'Strong', level_5: 'Parked', unset: 'No level',
}
const LEVEL_COLORS: Record<string, string> = {
  level_1: '#dc2626', level_2: '#2563eb', level_3: '#d97706', level_4: '#059669', level_5: '#cbd5e1', unset: '#e2e8f0',
}
const LEVEL_KEYS = ['level_1', 'level_2', 'level_3', 'level_4', 'level_5', 'unset'] as const

// Activity period: day-based filter on daily events
type ActivityPeriod = 'all' | '365' | '90' | '30' | '7'
const ACTIVITY_PERIODS: {value: ActivityPeriod; label: string}[] = [
  {value: '7',   label: '7 days'},
  {value: '30',  label: '30 days'},
  {value: '90',  label: '90 days'},
  {value: '365', label: '1 year'},
  {value: 'all', label: 'All time'},
]

// Month period: month-count filter on monthly aggregates
type MonthPeriod = 'all' | '12' | '6' | '3' | '1'
const MONTH_PERIODS: {value: MonthPeriod; label: string}[] = [
  {value: '1',   label: '1 month'},
  {value: '3',   label: '3 months'},
  {value: '6',   label: '6 months'},
  {value: '12',  label: '12 months'},
  {value: 'all', label: 'All time'},
]

type TopicSort = 'worst' | 'best' | 'largest' | 'weakest'

// ── helpers ───────────────────────────────────────────────────────────────────

function filterActivityByPeriod(days: DailyActivity[], period: ActivityPeriod): DailyActivity[] {
  if (period === 'all') return days
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - Number(period))
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return days.filter((d) => d.date >= cutoffStr)
}

function filterMonthsByPeriod(entries: [string, number][], period: MonthPeriod): [string, number][] {
  if (period === 'all') return entries
  const n = Number(period)
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - n + 1)
  cutoff.setDate(1)
  const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}`
  return entries.filter(([k]) => k >= cutoffKey)
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-')
  const name = new Date(Number(y), Number(m) - 1, 1).toLocaleString('default', {month: 'short'})
  return `${name} '${y.slice(2)}`
}

function dayLabel(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('default', {month: 'short', day: 'numeric'})
}

// ── Donut chart (pure SVG, no deps) ──────────────────────────────────────────

type DonutSlice = {value: number; color: string; label: string}

function DonutChart({slices, centerLabel, centerSub, size = 140}: {
  slices: DonutSlice[]
  centerLabel: string
  centerSub?: string
  size?: number
}) {
  const total = slices.reduce((s, d) => s + d.value, 0)
  if (total === 0) return null

  const r = 44
  const cx = 60
  const cy = 60
  const stroke = 14
  const circumference = 2 * Math.PI * r

  let offset = 0
  const paths = slices
    .filter((s) => s.value > 0)
    .map((s) => {
      const pct = s.value / total
      const dash = pct * circumference
      const gap  = circumference - dash
      const el = (
        <circle
          key={s.label}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={s.color}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${gap}`}
          strokeDashoffset={-offset}
          strokeLinecap="butt"
          style={{transition: 'stroke-dasharray 0.4s ease'}}
        />
      )
      offset += dash
      return el
    })

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className="stats-donut">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg)" strokeWidth={stroke} />
      {paths}
      <text x={cx} y={cy - 6} textAnchor="middle" className="stats-donut-label">{centerLabel}</text>
      {centerSub && <text x={cx} y={cy + 12} textAnchor="middle" className="stats-donut-sub">{centerSub}</text>}
    </svg>
  )
}

// ── Insights strip ────────────────────────────────────────────────────────────

function InsightsStrip({s}: {s: StatsResponse}) {
  const weakest = [...s.topics].sort((a, b) => a.progress - b.progress)[0]
  const strongest = [...s.topics].sort((a, b) => b.progress - a.progress)[0]
  const mostWeak = [...s.topics].sort((a, b) => b.weak_count - a.weak_count)[0]

  const insights: {icon: string; text: React.ReactNode}[] = []

  if (weakest && weakest.progress < 30)
    insights.push({icon: '⚠️', text: <><strong>{weakest.name}</strong> needs most attention — {weakest.progress}% progress</>})
  if (mostWeak && mostWeak.weak_count > 0)
    insights.push({icon: '📚', text: <><strong>{mostWeak.weak_count}</strong> weak words in <strong>{mostWeak.name}</strong></>})
  if (s.overview.missing_example > 0)
    insights.push({icon: '✏️', text: <><strong>{s.overview.missing_example.toLocaleString()}</strong> words missing examples</>})
  if (strongest && strongest.progress >= 80)
    insights.push({icon: '🏆', text: <>Best topic: <strong>{strongest.name}</strong> — {strongest.progress}%</>})

  if (insights.length === 0) return null

  return (
    <section className="stats-section stats-insights">
      <SectionTitle>What needs attention</SectionTitle>
      <div className="stats-insight-list">
        {insights.map((ins, i) => (
          <div key={i} className="stats-insight-item">
            <span className="stats-insight-icon">{ins.icon}</span>
            <span className="stats-insight-text">{ins.text}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── sub-components ────────────────────────────────────────────────────────────

function StatCard({value, label, sub}: {value: string | number; label: string; sub?: string}) {
  return (
    <div className="stats-card">
      <span className="stats-card-value">{typeof value === 'number' ? value.toLocaleString() : value}</span>
      <span className="stats-card-label">{label}</span>
      {sub && <span className="stats-card-sub">{sub}</span>}
    </div>
  )
}

function SectionTitle({children}: {children: React.ReactNode}) {
  return <h2 className="stats-section-title">{children}</h2>
}

function PeriodTabs<T extends string>({options, value, onChange}: {
  options: {value: T; label: string}[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="stats-period-tabs">
      {options.map((p) => (
        <button key={p.value} type="button"
          className={`stats-period-tab ${value === p.value ? 'active' : ''}`}
          onClick={() => onChange(p.value)}
        >{p.label}</button>
      ))}
    </div>
  )
}

function BarChart({data, color = 'var(--accent)'}: {data: {label: string; value: number}[]; color?: string}) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="stats-chart">
      {data.map((d, i) => (
        <div key={i} className="stats-chart-col">
          <span className="stats-chart-count">{d.value > 0 ? d.value : ''}</span>
          <div className="stats-chart-bar-wrap">
            <div className="stats-chart-bar" style={{height: `${(d.value / max) * 100}%`, background: color}} />
          </div>
          <span className="stats-chart-label">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export function StatsPage() {
  const navigate   = useNavigate()
  const statsQuery = useQuery({queryKey: ['stats'], queryFn: fetchStats})
  const s          = statsQuery.data

  const [activityPeriod, setActivityPeriod] = useState<ActivityPeriod>('30')
  const [monthPeriod,    setMonthPeriod]    = useState<MonthPeriod>('all')
  const [topicSort,      setTopicSort]      = useState<TopicSort>('worst')
  const [topicExpanded,  setTopicExpanded]  = useState(false)

  const filteredActivity = useMemo(
    () => s ? filterActivityByPeriod(s.daily_activity, activityPeriod) : [],
    [s, activityPeriod],
  )

  const activityTotals = useMemo(() => {
    let reviewed = 0, improved = 0, downgraded = 0, net = 0
    for (const d of filteredActivity) { reviewed += d.reviewed; improved += d.improved; downgraded += d.downgraded; net += d.net }
    return {reviewed, improved, downgraded, net}
  }, [filteredActivity])

  const activityChartData = useMemo(() => {
    const slice = [...filteredActivity].reverse().slice(-60)
    return slice.map((d) => ({label: dayLabel(d.date), value: d.improved}))
  }, [filteredActivity])

  const monthChartData = useMemo(() => {
    if (!s) return []
    const entries = Object.entries(s.words_added_by_month).sort(([a], [b]) => a.localeCompare(b))
    return filterMonthsByPeriod(entries, monthPeriod).map(([k, v]) => ({label: monthLabel(k), value: v}))
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

  const visibleTopics = topicExpanded ? sortedTopics : sortedTopics.slice(0, 10)

  const bestDay  = useMemo(() => filteredActivity.reduce((best, d) => d.net > (best?.net ?? -Infinity) ? d : best, null as DailyActivity | null), [filteredActivity])
  const worstDay = useMemo(() => filteredActivity.filter((d) => d.downgraded > 0).reduce((w, d) => d.downgraded > (w?.downgraded ?? -Infinity) ? d : w, null as DailyActivity | null), [filteredActivity])

  if (statsQuery.isLoading) return <div className="stats-loading">Loading…</div>
  if (!s) return <div className="stats-loading">Failed to load statistics.</div>

  const ov = s.overview
  const totalWords = ov.total_words

  // donut slices
  const knowledgeSlices = LEVEL_KEYS
    .map((k) => ({value: k === 'unset' ? s.level_counts.unset : s.level_counts[k], color: LEVEL_COLORS[k], label: LEVEL_LABELS[k]}))
    .filter((sl) => sl.value > 0)

  const enrichComplete   = totalWords - ov.needs_enrichment
  const enrichSlices = [
    {value: enrichComplete,        color: '#10b981', label: 'Complete'},
    {value: ov.needs_enrichment,   color: '#f97316', label: 'Needs enrichment'},
  ].filter((sl) => sl.value > 0)

  const okayOrBetterPct = s.okay_or_better_pct

  return (
    <div className="stats-page">
      <div className="stats-inner">

        {/* Header */}
        <div className="stats-topbar">
          <button type="button" className="word-page-back-btn" onClick={() => navigate(-1)}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="9,2 4,7 9,12" />
            </svg>
            Back
          </button>
          <h1 className="stats-title">Statistics</h1>
        </div>

        {/* ── Insights strip ──────────────────────────────────────────────── */}
        <InsightsStrip s={s} />

        {/* ── Vocabulary overview ─────────────────────────────────────────── */}
        <section className="stats-section">
          <SectionTitle>Vocabulary overview</SectionTitle>
          <div className="stats-cards stats-cards-4">
            <StatCard value={ov.total_words}  label="Total words" />
            <StatCard value={ov.total_topics} label="Topics" />
            <StatCard value={s.level_counts.level_4} label="Strong (lvl 4)" />
            <StatCard value={`${okayOrBetterPct}%`} label="Okay or better" />
          </div>
        </section>

        {/* ── Knowledge distribution (donut) ──────────────────────────────── */}
        <section className="stats-section">
          <SectionTitle>Knowledge distribution</SectionTitle>
          {totalWords > 0 ? (
            <div className="stats-donut-row">
              <DonutChart
                slices={knowledgeSlices}
                centerLabel={totalWords.toLocaleString()}
                centerSub="words"
                size={150}
              />
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
          ) : (
            <div className="stats-empty">No words yet.</div>
          )}
        </section>

        {/* ── Daily progress ──────────────────────────────────────────────── */}
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

          {activityChartData.length > 0 ? (
            <BarChart data={activityChartData} color="#10b981" />
          ) : (
            <div className="stats-empty">No level changes recorded for this period. Start studying to see progress here.</div>
          )}

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

        {/* ── Words added by month ────────────────────────────────────────── */}
        <section className="stats-section">
          <div className="stats-section-header">
            <SectionTitle>Words added by month</SectionTitle>
            <PeriodTabs options={MONTH_PERIODS} value={monthPeriod} onChange={setMonthPeriod} />
          </div>
          {monthChartData.length > 0 ? (
            <BarChart data={monthChartData} />
          ) : (
            <div className="stats-empty">No data for this period.</div>
          )}
        </section>

        {/* ── Topics ─────────────────────────────────────────────────────── */}
        <section className="stats-section">
          <div className="stats-section-header">
            <SectionTitle>Topics</SectionTitle>
            <PeriodTabs
              options={[['worst','Worst first'],['best','Best first'],['largest','Largest'],['weakest','Most weak']] .map(([v, l]) => ({value: v as TopicSort, label: l as string}))}
              value={topicSort}
              onChange={setTopicSort}
            />
          </div>

          {sortedTopics.length === 0 ? (
            <div className="stats-empty">No topics with words yet.</div>
          ) : (
            <>
              <div className="stats-topic-table">
                <div className="stats-topic-header">
                  <span>Topic</span>
                  <span className="stats-col-center stats-topic-count">Words</span>
                  <span className="stats-col-center stats-topic-weak">Weak</span>
                  <span className="stats-col-center stats-topic-missing">No ex.</span>
                  <span className="stats-col-right">Progress</span>
                </div>
                {visibleTopics.map((row) => (
                  <div key={row.id} className="stats-topic-row" onClick={() => navigate(`/topics/${row.slug}`)}>
                    <span className="stats-topic-name">{row.name}</span>
                    <span className="stats-col-center stats-topic-count">{row.total}</span>
                    <span className={`stats-col-center stats-topic-weak ${row.weak_count > 0 ? 'has-weak' : ''}`}>
                      {row.weak_count > 0 ? row.weak_count : '—'}
                    </span>
                    <span className={`stats-col-center stats-topic-missing ${row.missing_example > 0 ? 'has-missing' : ''}`}>
                      {row.missing_example > 0 ? row.missing_example : '—'}
                    </span>
                    <div className="stats-topic-progress-wrap">
                      <span className="stats-topic-pct">{row.progress}%</span>
                      <div className="stats-topic-bar">
                        <div className="stats-topic-bar-fill" style={{width: `${row.progress}%`}} />
                      </div>
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

        {/* ── Data quality (donut) ────────────────────────────────────────── */}
        <section className="stats-section">
          <SectionTitle>Data quality</SectionTitle>
          <div className="stats-donut-row">
            <DonutChart
              slices={enrichSlices}
              centerLabel={`${Math.round((enrichComplete / Math.max(1, totalWords)) * 100)}%`}
              centerSub="complete"
              size={130}
            />
            <div className="stats-quality-detail">
              <div className="stats-cards stats-cards-2">
                <StatCard value={ov.missing_example} label="Missing example" />
                <StatCard value={ov.missing_pos}     label="Missing POS" />
                <StatCard value={s.level_counts.unset} label="No level set" />
                <StatCard value={ov.needs_enrichment} label="Need enrichment" />
              </div>
              <div className="stats-quality-row">
                <div className="stats-quality-item">
                  <span className="stats-quality-label">Example coverage</span>
                  <div className="stats-quality-bar-wrap">
                    <div className="stats-quality-bar" style={{width: `${Math.round((ov.with_example / Math.max(1, totalWords)) * 100)}%`, background: '#10b981'}} />
                  </div>
                  <span className="stats-quality-pct">{Math.round((ov.with_example / Math.max(1, totalWords)) * 100)}%</span>
                </div>
                <div className="stats-quality-item">
                  <span className="stats-quality-label">POS coverage</span>
                  <div className="stats-quality-bar-wrap">
                    <div className="stats-quality-bar" style={{width: `${Math.round((ov.with_pos / Math.max(1, totalWords)) * 100)}%`, background: '#6366f1'}} />
                  </div>
                  <span className="stats-quality-pct">{Math.round((ov.with_pos / Math.max(1, totalWords)) * 100)}%</span>
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}
