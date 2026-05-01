import {useNavigate} from 'react-router-dom'
import {routes} from '@/app/routes'
import type {DailyActivity, StatsResponse, TopicStat} from '@/features/stats/api/statsApi'
import {BarChart, DonutChart, PeriodTabs, SectionTitle, StatCard} from '@/features/stats/components/StatsComponents'
import {
  ACTIVITY_PERIODS,
  LEVEL_COLORS,
  LEVEL_KEYS,
  LEVEL_LABELS,
  MONTH_PERIODS,
  TOPIC_SORT_OPTIONS,
  dayLabel,
  type ActivityPeriod,
  type MonthPeriod,
  type TopicSort,
} from '@/features/stats/model/statsPageModel'

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
