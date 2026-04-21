import type {ReactNode} from 'react'

// Shared chart components for the Stats page

export type DonutSlice = {value: number; color: string; label: string}

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

export function BarChart({data, color = 'var(--accent)'}: {data: {label: string; value: number}[]; color?: string}) {
  const max = Math.max(1, ...data.map((d) => Math.abs(d.value)))
  return (
    <div className="stats-chart">
      {data.map((d, i) => (
        <div key={i} className="stats-chart-col">
          <span className="stats-chart-count" style={d.value < 0 ? {color: 'var(--danger, #dc2626)'} : {}}>
            {d.value !== 0 ? d.value : ''}
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

export function StatCard({value, label, sub}: {value: string | number; label: string; sub?: string}) {
  return (
    <div className="stats-card">
      <span className="stats-card-value">{typeof value === 'number' ? value.toLocaleString() : value}</span>
      <span className="stats-card-label">{label}</span>
      {sub && <span className="stats-card-sub">{sub}</span>}
    </div>
  )
}

export function SectionTitle({children}: {children: ReactNode}) {
  return <h2 className="stats-section-title">{children}</h2>
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
