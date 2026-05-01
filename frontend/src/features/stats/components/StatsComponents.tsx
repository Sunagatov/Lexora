import {useEffect, useState, type ReactNode} from 'react'

// Shared chart components for the Stats page

export type DonutSlice = {value: number; color: string; label: string}

type Trend = {
  value: string
  direction: 'up' | 'down' | 'flat'
  tone?: 'good' | 'bad' | 'neutral'
}

function StatSparkline({values}: {values: number[]}) {
  if (values.length < 2) return null

  const width = 120
  const height = 32
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(1, max - min)

  const points = values.map((value, index) => {
    const x = (index / Math.max(1, values.length - 1)) * width
    const y = height - ((value - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')

  const area = `${points} ${width},${height} 0,${height}`

  return (
    <svg className="stats-card-sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <polygon className="stats-card-sparkline-area" points={area} />
      <polyline className="stats-card-sparkline-line" points={points} />
    </svg>
  )
}

const STAT_META: Record<string, {icon: string; tone: string}> = {
  'Total words': {icon: '📚', tone: 'indigo'},
  Topics: {icon: '🗂️', tone: 'sky'},
  'Strong (lvl 4)': {icon: '💪', tone: 'emerald'},
  'Okay or better': {icon: '✨', tone: 'violet'},
  'Active time': {icon: '⏱️', tone: 'sky'},
  Today: {icon: '📍', tone: 'indigo'},
  'This week': {icon: '📅', tone: 'sky'},
  Sessions: {icon: '🪑', tone: 'violet'},
  'Avg session': {icon: '🕒', tone: 'sky'},
  'Longest session': {icon: '🏁', tone: 'indigo'},
  'Reviewed words': {icon: '🔁', tone: 'sky'},
  'Never reviewed': {icon: '🆕', tone: 'amber'},
  'Improved words': {icon: '📈', tone: 'emerald'},
  'Regressed words': {icon: '📉', tone: 'rose'},
  'Strong now': {icon: '🏆', tone: 'emerald'},
  Parked: {icon: '🧊', tone: 'slate'},
  'Active streak': {icon: '🔥', tone: 'amber'},
  'Study streak': {icon: '⚡', tone: 'indigo'},
  'Longest active': {icon: '🌤️', tone: 'amber'},
  'Longest study': {icon: '🎯', tone: 'violet'},
  'Active days': {icon: '📆', tone: 'sky'},
  'Study days': {icon: '✅', tone: 'emerald'},
  'App consistency': {icon: '🧭', tone: 'sky'},
  'Study consistency': {icon: '🧠', tone: 'violet'},
  'Reviews / minute': {icon: '🚀', tone: 'indigo'},
  'Improved / minute': {icon: '🌱', tone: 'emerald'},
  'Net / minute': {icon: '📊', tone: 'violet'},
  'Reviewed / session': {icon: '📝', tone: 'sky'},
  'Improved / session': {icon: '🌟', tone: 'emerald'},
  'Active minutes': {icon: '⌛', tone: 'amber'},
  Queues: {icon: '🧺', tone: 'sky'},
  Completed: {icon: '✔️', tone: 'emerald'},
  'Completion rate': {icon: '🎉', tone: 'emerald'},
  'Avg queue size': {icon: '📦', tone: 'violet'},
  'Avg completion': {icon: '🔄', tone: 'sky'},
  'Avg completion time': {icon: '⏳', tone: 'amber'},
  'Level changes': {icon: '🪄', tone: 'violet'},
  Improved: {icon: '⬆️', tone: 'emerald'},
  Downgraded: {icon: '⬇️', tone: 'rose'},
  'Net progress': {icon: '📌', tone: 'indigo'},
  '3+ examples': {icon: '🧪', tone: 'amber'},
  'Need 3+ examples': {icon: '✏️', tone: 'amber'},
  'Missing POS': {icon: '🏷️', tone: 'rose'},
  'No level set': {icon: '⚪', tone: 'slate'},
}

function CountUpValue({value, duration = 850}: {value: number; duration?: number}) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    let frame = 0
    const start = performance.now()

    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayValue(Math.round(value * eased))
      if (progress < 1) frame = window.requestAnimationFrame(tick)
    }

    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [value, duration])

  return <>{displayValue.toLocaleString()}</>
}

export function DonutChart({slices, centerLabel, centerSub, size = 140}: {
  slices: DonutSlice[]
  centerLabel: string
  centerSub?: string
  size?: number
}) {
  const total = slices.reduce((s, d) => s + d.value, 0)
  if (total === 0) return null

  const r = 44, cx = 60, cy = 60, stroke = 14
  const circumference = 2 * Math.PI * r
  let offset = 0

  const paths = slices.filter((s) => s.value > 0).map((s) => {
    const dash = (s.value / total) * circumference
    const el = (
      <circle key={s.label} cx={cx} cy={cy} r={r} fill="none" stroke={s.color}
        strokeWidth={stroke} strokeDasharray={`${dash} ${circumference - dash}`}
        strokeDashoffset={-offset} strokeLinecap="butt"
        style={{transition: 'stroke-dasharray 0.4s ease'}} />
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

export function BarChart({
  data,
  color = 'var(--accent)',
  formatValue,
}: {
  data: {label: string; value: number}[]
  color?: string
  formatValue?: (value: number) => string
}) {
  const max = Math.max(1, ...data.map((d) => Math.abs(d.value)))
  return (
    <div className="stats-chart">
      {data.map((d, i) => (
        <div key={i} className="stats-chart-col">
          <span className="stats-chart-count" style={d.value < 0 ? {color: 'var(--danger, #dc2626)'} : {}}>
            {d.value !== 0 ? (formatValue ? formatValue(d.value) : d.value) : ''}
          </span>
          <div className="stats-chart-bar-wrap">
            <div
              className="stats-chart-bar"
              style={{
                height: `${(Math.abs(d.value) / max) * 100}%`,
                background: d.value < 0 ? 'var(--danger, #dc2626)' : color,
              }}
            />
          </div>
          <span className="stats-chart-label">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

export function StatCard({
  value,
  label,
  sub,
  trend,
  icon,
  tone,
  sparkline,
}: {
  value: string | number
  label: string
  sub?: string
  trend?: Trend
  icon?: string
  tone?: string
  sparkline?: number[]
}) {
  const meta = STAT_META[label]
  const cardIcon = icon ?? meta?.icon ?? '•'
  const cardTone = tone ?? meta?.tone ?? 'slate'

  return (
    <div className={`stats-card stats-card-tone-${cardTone}`}>
      <div className="stats-card-topline">
        <span className="stats-card-icon" aria-hidden="true">{cardIcon}</span>
        {trend && (
          <span className={`stats-trend stats-trend-${trend.tone ?? 'neutral'} stats-trend-${trend.direction}`}>
            {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'} {trend.value}
          </span>
        )}
      </div>
      <span className="stats-card-value">{typeof value === 'number' ? <CountUpValue value={value} /> : value}</span>
      <span className="stats-card-label">{label}</span>
      {sub && <span className="stats-card-sub">{sub}</span>}
      {sparkline && sparkline.length > 1 && <StatSparkline values={sparkline} />}
    </div>
  )
}

export function SectionTitle({
  children,
  icon,
  subtitle,
}: {
  children: ReactNode
  icon?: string
  subtitle?: string
}) {
  return (
    <div className="stats-section-title-wrap">
      {icon && <span className="stats-section-icon" aria-hidden="true">{icon}</span>}
      <div className="stats-section-copy">
        <h2 className="stats-section-title">{children}</h2>
        {subtitle && <p className="stats-section-subtitle">{subtitle}</p>}
      </div>
    </div>
  )
}

export function PeriodTabs<T extends string>({options, value, onChange}: {
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

export function QualityBars({
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
