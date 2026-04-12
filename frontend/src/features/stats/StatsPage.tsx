import {useMemo, useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {useQuery} from '@tanstack/react-query'
import {fetchStats} from './api'
import type {DailyActivity, TopicStat} from './api'

const LEVEL_LABELS: Record<string, string> = {
  level_1: 'Weak', level_2: 'Basic', level_3: 'Okay', level_4: 'Strong', level_5: 'Parked', unset: 'No level',
}
const LEVEL_COLORS: Record<string, string> = {
  level_1: '#ef4444', level_2: '#f97316', level_3: '#eab308', level_4: '#10b981', level_5: '#cbd5e1', unset: '#e2e8f0',
}

type Period = 'all' | '365' | '90' | '30' | '7'
const PERIOD_LABELS: {value: Period; label: string}[] = [
  {value: '7',   label: 'Last 7 days'},
  {value: '30',  label: 'Last 30 days'},
  {value: '90',  label: 'Last 90 days'},
  {value: '365', label: 'Last year'},
  {value: 'all', label: 'All time'},
]

type TopicSort = 'worst' | 'best' | 'largest' | 'weakest'

function filterByPeriod(days: DailyActivity[], period: Period): DailyActivity[] {
  if (period === 'all') return days
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - Number(period))
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return days.filter((d) => d.date >= cutoffStr)
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-')
  const monthName = new Date(Number(y), Number(m) - 1, 1).toLocaleString('default', {month: 'short'})
  return `${monthName} '${y.slice(2)}`
}

function dayLabel(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('default', {month: 'short', day: 'numeric'})
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

function BarChart({data, labelKey, valueKey, color = 'var(--accent)'}: {
  data: {label: string; value: number}[]
  labelKey?: string
  valueKey?: string
  color?: string
}) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="stats-chart">
      {data.map((d, i) => {
        const pct = (d.value / max) * 100
        return (
          <div key={i} className="stats-chart-col">
            <span className="stats-chart-count">{d.value > 0 ? d.value : ''}</span>
            <div className="stats-chart-bar-wrap">
              <div className="stats-chart-bar" style={{height: `${pct}%`, background: color}} />
            </div>
            <span className="stats-chart-label">{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export function StatsPage() {
  const navigate   = useNavigate()
  const statsQuery = useQuery({queryKey: ['stats'], queryFn: fetchStats})
  const s          = statsQuery.data

  const [activityPeriod, setActivityPeriod] = useState<Period>('30')
  const [monthPeriod,    setMonthPeriod]    = useState<Period>('all')
  const [topicSort,      setTopicSort]      = useState<TopicSort>('worst')
  const [topicExpanded,  setTopicExpanded]  = useState(false)

  // ── derived ────────────────────────────────────────────────────────────────

  const filteredActivity = useMemo(
    () => s ? filterByPeriod(s.daily_activity, activityPeriod) : [],
    [s, activityPeriod],
  )

  // aggregate totals for the selected activity period
  const activityTotals = useMemo(() => {
    let reviewed = 0, improved = 0, downgraded = 0, net = 0
    for (const d of filteredActivity) {
      reviewed   += d.reviewed
      improved   += d.improved
      downgraded += d.downgraded
      net        += d.net
    }
    return {reviewed, improved, downgraded, net}
  }, [filteredActivity])

  // daily activity chart — show up to 60 bars, oldest→newest
  const activityChartData = useMemo(() => {
    const slice = [...filteredActivity].reverse().slice(-60)
    return slice.map((d) => ({label: dayLabel(d.date), value: d.net >= 0 ? d.improved : 0, net: d.net, reviewed: d.reviewed}))
  }, [filteredActivity])

  // words added by month chart
  const monthChartData = useMemo(() => {
    if (!s) return []
    const entries = Object.entries(s.words_added_by_month).sort(([a], [b]) => a.localeCompare(b))
    const filtered = monthPeriod === 'all' ? entries : (() => {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - Number(monthPeriod))
      const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}`
      return entries.filter(([k]) => k >= cutoffKey)
    })()
    return filtered.map(([k, v]) => ({label: monthLabel(k), value: v}))
  }, [s, monthPeriod])

  // sorted topics
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

  // level distribution
  const levelKeys = ['level_1', 'level_2', 'level_3', 'level_4', 'level_5', 'unset'] as const
  const totalWords = s?.overview.total_words ?? 0

  // best/worst day in selected period
  const bestDay  = useMemo(() => filteredActivity.reduce((best, d) => d.net > (best?.net ?? -Infinity) ? d : best, null as DailyActivity | null), [filteredActivity])
  const worstDay = useMemo(() => filteredActivity.filter((d) => d.downgraded > 0).reduce((w, d) => d.downgraded > (w?.downgraded ?? -Infinity) ? d : w, null as DailyActivity | null), [filteredActivity])

  if (statsQuery.isLoading) return <div className="stats-loading">Loading…</div>
  if (!s) return <div className="stats-loading">Failed to load statistics.</div>

  const ov = s.overview

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

        {/* ── Vocabulary overview ─────────────────────────────────────────── */}
        <section className="stats-section">
          <SectionTitle>Vocabulary overview</SectionTitle>
          <div className="stats-cards stats-cards-6">
            <StatCard value={ov.total_words}  label="Total words" />
            <StatCard value={ov.total_topics} label="Topics" />
            <StatCard value={s.level_counts.level_4} label="Strong (lvl 4)" />
            <StatCard value={`${s.okay_or_better_pct}%`} label="Okay or better" />
            <StatCard value={ov.with_example} label="Have example" sub={`${Math.round((ov.with_example / Math.max(1, ov.total_words)) * 100)}%`} />
            <StatCard value={ov.needs_enrichment} label="Need enrichment" sub="missing example or POS" />
          </div>

          {/* quality bar */}
          <div className="stats-quality-row">
            <div className="stats-quality-item">
              <span className="stats-quality-label">With example</span>
              <div className="stats-quality-bar-wrap">
                <div className="stats-quality-bar" style={{width: `${Math.round((ov.with_example / Math.max(1, ov.total_words)) * 100)}%`, background: '#10b981'}} />
              </div>
              <span className="stats-quality-pct">{Math.round((ov.with_example / Math.max(1, ov.total_words)) * 100)}%</span>
            </div>
            <div className="stats-quality-item">
              <span className="stats-quality-label">With part of speech</span>
              <div className="stats-quality-bar-wrap">
                <div className="stats-quality-bar" style={{width: `${Math.round((ov.with_pos / Math.max(1, ov.total_words)) * 100)}%`, background: '#6366f1'}} />
              </div>
              <span className="stats-quality-pct">{Math.round((ov.with_pos / Math.max(1, ov.total_words)) * 100)}%</span>
            </div>
          </div>
        </section>

        {/* ── Level distribution ──────────────────────────────────────────── */}
        <section className="stats-section">
          <SectionTitle>Knowledge distribution</SectionTitle>
          {totalWords > 0 ? (
            <>
              <div className="stats-dist-bar">
                {levelKeys.map((k) => {
                  const count = k === 'unset' ? s.level_counts.unset : s.level_counts[k]
                  const pct = (count / totalWords) * 100
                  return pct > 0 ? (
                    <div key={k} className="stats-dist-segment" style={{width: `${pct}%`, background: LEVEL_COLORS[k]}}
                      title={`${LEVEL_LABELS[k]}: ${count}`} />
                  ) : null
                })}
              </div>
              <div className="stats-dist-legend">
                {levelKeys.map((k) => {
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
            </>
          ) : (
            <div className="stats-empty">No words yet.</div>
          )}
        </section>

        {/* ── Daily progress ──────────────────────────────────────────────── */}
        <section className="stats-section">
          <div className="stats-section-header">
            <SectionTitle>Daily progress</SectionTitle>
            <div className="stats-period-tabs">
              {PERIOD_LABELS.map((p) => (
                <button key={p.value} type="button"
                  className={`stats-period-tab ${activityPeriod === p.value ? 'active' : ''}`}
                  onClick={() => setActivityPeriod(p.value)}
                >{p.label}</button>
              ))}
            </div>
          </div>

          <div className="stats-cards stats-cards-4">
            <StatCard value={activityTotals.reviewed}   label="Words reviewed" />
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
            <div className="stats-empty">No activity recorded for this period.</div>
          )}

          {/* full daily table */}
          {filteredActivity.length > 0 && (
            <details className="stats-daily-details">
              <summary className="stats-daily-summary">Show daily breakdown ({filteredActivity.length} days)</summary>
              <div className="stats-daily-table">
                <div className="stats-daily-header">
                  <span>Date</span>
                  <span className="stats-col-center">Reviewed</span>
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
            <div className="stats-period-tabs">
              {PERIOD_LABELS.map((p) => (
                <button key={p.value} type="button"
                  className={`stats-period-tab ${monthPeriod === p.value ? 'active' : ''}`}
                  onClick={() => setMonthPeriod(p.value)}
                >{p.label}</button>
              ))}
            </div>
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
            <div className="stats-period-tabs">
              {([['worst','Worst first'],['best','Best first'],['largest','Largest'],['weakest','Most weak']] as [TopicSort, string][]).map(([v, l]) => (
                <button key={v} type="button"
                  className={`stats-period-tab ${topicSort === v ? 'active' : ''}`}
                  onClick={() => setTopicSort(v)}
                >{l}</button>
              ))}
            </div>
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
                      <span className="stats-topic-pct">{row.progress > 0 ? `${row.progress}%` : '—'}</span>
                      {row.progress > 0 && (
                        <div className="stats-topic-bar">
                          <div className="stats-topic-bar-fill" style={{width: `${row.progress}%`}} />
                        </div>
                      )}
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

        {/* ── Data quality ───────────────────────────────────────────────── */}
        <section className="stats-section">
          <SectionTitle>Data quality</SectionTitle>
          <div className="stats-cards stats-cards-4">
            <StatCard value={ov.missing_example} label="Missing example" />
            <StatCard value={ov.missing_pos}     label="Missing part of speech" />
            <StatCard value={s.level_counts.unset} label="No level set" />
            <StatCard value={ov.needs_enrichment} label="Need enrichment" />
          </div>
          <div className="stats-quality-row">
            <div className="stats-quality-item">
              <span className="stats-quality-label">Example coverage</span>
              <div className="stats-quality-bar-wrap">
                <div className="stats-quality-bar" style={{width: `${Math.round((ov.with_example / Math.max(1, ov.total_words)) * 100)}%`, background: '#10b981'}} />
              </div>
              <span className="stats-quality-pct">{ov.with_example.toLocaleString()} / {ov.total_words.toLocaleString()}</span>
            </div>
            <div className="stats-quality-item">
              <span className="stats-quality-label">POS coverage</span>
              <div className="stats-quality-bar-wrap">
                <div className="stats-quality-bar" style={{width: `${Math.round((ov.with_pos / Math.max(1, ov.total_words)) * 100)}%`, background: '#6366f1'}} />
              </div>
              <span className="stats-quality-pct">{ov.with_pos.toLocaleString()} / {ov.total_words.toLocaleString()}</span>
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}
