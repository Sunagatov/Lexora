import type {ReactNode} from 'react'
import type {StatsResponse} from './api'
import {SectionTitle} from './StatsComponents'

export function InsightsStrip({s}: {s: StatsResponse}) {
  const weakest = [...s.topics].sort((a, b) => a.progress - b.progress)[0]
  const strongest = [...s.topics].sort((a, b) => b.progress - a.progress)[0]
  const mostWeak = [...s.topics].sort((a, b) => b.weak_count - a.weak_count)[0]
  const mostRegressed = [...s.topics].sort((a, b) => b.regressed_count - a.regressed_count)[0]
  const leastReviewed = [...s.topics].sort((a, b) => a.reviewed_count - b.reviewed_count)[0]

  const insights: {icon: string; text: ReactNode}[] = []

  if (weakest && weakest.progress < 30)
    insights.push({icon: '⚠️', text: <><strong>{weakest.name}</strong> needs most attention — {weakest.progress}% progress</>})
  if (mostWeak && mostWeak.weak_count > 0)
    insights.push({icon: '📚', text: <><strong>{mostWeak.weak_count}</strong> weak words in <strong>{mostWeak.name}</strong></>})
  if (mostRegressed && mostRegressed.regressed_count > 0)
    insights.push({icon: '📉', text: <><strong>{mostRegressed.regressed_count}</strong> words regressed in <strong>{mostRegressed.name}</strong></>})
  if (leastReviewed && leastReviewed.reviewed_count === 0 && leastReviewed.total > 0)
    insights.push({icon: '🕳️', text: <><strong>{leastReviewed.name}</strong> has not been reviewed yet</>})
  if (s.overview.needs_example_enrichment > 0)
    insights.push({icon: '✏️', text: <><strong>{s.overview.needs_example_enrichment.toLocaleString()}</strong> words need 3+ examples</>})
  if (strongest && strongest.progress >= 80)
    insights.push({icon: '🏆', text: <>Best topic: <strong>{strongest.name}</strong> — {strongest.progress}%</>})
  if (s.consistency_summary.active_streak_days > 0)
    insights.push({icon: '🔥', text: <>Active streak: <strong>{s.consistency_summary.active_streak_days}</strong> days</>})
  if (s.queue_summary.total_queues > 0)
    insights.push({icon: '⏱️', text: <>Queue completion: <strong>{s.queue_summary.completion_rate_pct}%</strong> across {s.queue_summary.total_queues} queues</>})
  if (s.retention_summary.never_reviewed_words > 0)
    insights.push({icon: '🧭', text: <><strong>{s.retention_summary.never_reviewed_words.toLocaleString()}</strong> words have never been reviewed</>})

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
