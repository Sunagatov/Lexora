import type {ReactNode} from 'react'
import type {LearningStatsResponse} from '@/features/stats/types/statsTypes'
import {SectionTitle} from '@/features/stats/components/StatsComponents'

export function InsightsStrip({s}: {s: LearningStatsResponse}) {
  const mostImproved = [...s.topics].sort((a, b) => b.improved_count - a.improved_count)[0]
  const mostRegressed = [...s.topics].sort((a, b) => b.regressed_count - a.regressed_count)[0]

  const insights: {icon: string; text: ReactNode}[] = []

  if (mostImproved && mostImproved.improved_count > 0)
    insights.push({icon: '🏆', text: <><strong>{mostImproved.improved_count}</strong> words improved in <strong>{mostImproved.name}</strong></>})
  if (mostRegressed && mostRegressed.regressed_count > 0)
    insights.push({icon: '📉', text: <><strong>{mostRegressed.regressed_count}</strong> words regressed in <strong>{mostRegressed.name}</strong></>})

  if (insights.length === 0) return null

  return (
    <section className="stats-section stats-insights">
      <SectionTitle>Topic highlights</SectionTitle>
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
