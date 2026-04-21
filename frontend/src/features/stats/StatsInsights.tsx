import type {ReactNode} from 'react'
import type {StatsResponse} from './api'
import {SectionTitle} from './StatsComponents'

export function InsightsStrip({s}: {s: StatsResponse}) {
  const weakest  = [...s.topics].sort((a, b) => a.progress - b.progress)[0]
  const strongest = [...s.topics].sort((a, b) => b.progress - a.progress)[0]
  const mostWeak = [...s.topics].sort((a, b) => b.weak_count - a.weak_count)[0]

  const insights: {icon: string; text: ReactNode}[] = []

  if (weakest && weakest.progress < 30)
    insights.push({icon: '⚠️', text: <><strong>{weakest.name}</strong> needs most attention — {weakest.progress}% progress</>})
  if (mostWeak && mostWeak.weak_count > 0)
    insights.push({icon: '📚', text: <><strong>{mostWeak.weak_count}</strong> weak words in <strong>{mostWeak.name}</strong></>})
  if (s.overview.needs_example_enrichment > 0)
    insights.push({icon: '✏️', text: <><strong>{s.overview.needs_example_enrichment.toLocaleString()}</strong> words need 3+ examples</>})
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
