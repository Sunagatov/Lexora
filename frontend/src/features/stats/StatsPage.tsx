import {useMemo} from 'react'
import {useNavigate} from 'react-router-dom'
import {useQuery} from '@tanstack/react-query'
import {fetchTopics} from '../topics/api'
import {fetchWords} from '../words/api'
import type {Word, Topic} from '../../shared/http'
import {ACTIVE_LEVELS, PARKED_LEVEL, LEVEL_LABELS} from '../../shared/wordDomain'

// ── helpers ───────────────────────────────────────────────────────────────────

function calcTopicProgress(words: Word[]): number {
  let scoreSum = 0, count = 0
  for (const w of words) {
    const l = w.knowledge_level
    if (!l || l < 1 || l > 4) continue
    scoreSum += (l - 1) / 3
    count++
  }
  return count > 0 ? Math.round((scoreSum / count) * 100) : 0
}

function monthKey(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function lastNMonths(n: number): string[] {
  const keys: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return keys
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-')
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleString('default', {month: 'short', year: '2-digit'})
}

// ── component ─────────────────────────────────────────────────────────────────

export function StatsPage() {
  const navigate    = useNavigate()
  const topicsQuery = useQuery({queryKey: ['topics'], queryFn: fetchTopics})
  const wordsQuery  = useQuery({queryKey: ['words'],  queryFn: () => fetchWords()})

  const topics: Topic[] = topicsQuery.data ?? []
  const words:  Word[]  = wordsQuery.data  ?? []
  const isLoading = topicsQuery.isLoading || wordsQuery.isLoading

  // overall level counts
  const levelCounts = useMemo(() => {
    const c: Record<number, number> = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for (const w of words) c[w.knowledge_level ?? 0] = (c[w.knowledge_level ?? 0] ?? 0) + 1
    return c
  }, [words])

  const grandTotal  = words.length
  const activeTotal = ACTIVE_LEVELS.reduce((s, l) => s + (levelCounts[l] ?? 0), 0)
  const parkedCount = levelCounts[PARKED_LEVEL] ?? 0
  const unsetCount  = levelCounts[0] ?? 0
  const okayOrBetter = grandTotal > 0
    ? Math.round(((levelCounts[3] + levelCounts[4]) / Math.max(1, activeTotal)) * 100)
    : 0

  // words added by month — last 6
  const months = useMemo(() => lastNMonths(6), [])
  const wordsByMonth = useMemo(() => {
    const m: Record<string, number> = {}
    for (const key of months) m[key] = 0
    for (const w of words) {
      const k = monthKey(w.created_at)
      if (k in m) m[k]++
    }
    return m
  }, [words, months])
  const maxMonthCount = Math.max(1, ...Object.values(wordsByMonth))

  // per-topic rows sorted by progress ascending (worst first)
  const topicRows = useMemo(() => {
    return topics
      .map((t) => {
        const tw = words.filter((w) => w.topic_ids.includes(t.id))
        if (tw.length === 0) return null
        const lc: Record<number, number> = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
        for (const w of tw) {
          const l = w.knowledge_level
          if (l && l >= 1 && l <= 5) lc[l] = (lc[l] ?? 0) + 1
        }
        const hasActive = ACTIVE_LEVELS.some((l) => lc[l] > 0)
        return {id: t.id, slug: t.slug, name: t.name, total: tw.length, lc, hasActive, progress: calcTopicProgress(tw)}
      })
      .filter(Boolean)
      .sort((a, b) => a!.progress - b!.progress) as NonNullable<ReturnType<typeof topics['map']>[number]>[]
  }, [topics, words]) as Array<{id: number; slug: string; name: string; total: number; lc: Record<number,number>; hasActive: boolean; progress: number}>

  if (isLoading) return <div className="stats-loading">Loading…</div>

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

        {/* Summary cards */}
        <div className="stats-cards">
          <div className="stats-card">
            <span className="stats-card-value">{grandTotal.toLocaleString()}</span>
            <span className="stats-card-label">Total words</span>
          </div>
          <div className="stats-card">
            <span className="stats-card-value">{topics.length}</span>
            <span className="stats-card-label">Topics</span>
          </div>
          <div className="stats-card">
            <span className="stats-card-value">{levelCounts[4] ?? 0}</span>
            <span className="stats-card-label">Strong (lvl 4)</span>
          </div>
          <div className="stats-card">
            <span className="stats-card-value">{okayOrBetter}%</span>
            <span className="stats-card-label">Okay or better</span>
          </div>
        </div>

        {/* Level distribution */}
        <section className="stats-section">
          <h2 className="stats-section-title">Level distribution</h2>
          {grandTotal > 0 ? (
            <>
              <div className="stats-dist-bar">
                {ACTIVE_LEVELS.map((l) => {
                  const pct = (levelCounts[l] / grandTotal) * 100
                  return pct > 0 ? (
                    <div key={l} className={`stats-dist-segment level-${l}`} style={{width: `${pct}%`}}
                      title={`${LEVEL_LABELS[l]}: ${levelCounts[l]}`} />
                  ) : null
                })}
                {parkedCount > 0 && (
                  <div className="stats-dist-segment level-5" style={{width: `${(parkedCount / grandTotal) * 100}%`}}
                    title={`Parked: ${parkedCount}`} />
                )}
                {unsetCount > 0 && (
                  <div className="stats-dist-segment level-unset" style={{width: `${(unsetCount / grandTotal) * 100}%`}}
                    title={`No level: ${unsetCount}`} />
                )}
              </div>
              <div className="stats-dist-legend">
                {ACTIVE_LEVELS.map((l) => (
                  <div key={l} className="stats-legend-item">
                    <span className={`stats-legend-dot level-${l}`} />
                    <span className="stats-legend-label">{LEVEL_LABELS[l]}</span>
                    <span className="stats-legend-count">{levelCounts[l] ?? 0}</span>
                  </div>
                ))}
                {parkedCount > 0 && (
                  <div className="stats-legend-item">
                    <span className="stats-legend-dot level-5" />
                    <span className="stats-legend-label">Parked</span>
                    <span className="stats-legend-count">{parkedCount}</span>
                  </div>
                )}
                {unsetCount > 0 && (
                  <div className="stats-legend-item">
                    <span className="stats-legend-dot level-unset" />
                    <span className="stats-legend-label">No level</span>
                    <span className="stats-legend-count">{unsetCount}</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="stats-empty">No words yet.</div>
          )}
        </section>

        {/* Words added by month */}
        <section className="stats-section">
          <h2 className="stats-section-title">Words added — last 6 months</h2>
          <div className="stats-chart">
            {months.map((key) => {
              const count = wordsByMonth[key]
              const heightPct = (count / maxMonthCount) * 100
              return (
                <div key={key} className="stats-chart-col">
                  <span className="stats-chart-count">{count > 0 ? count : ''}</span>
                  <div className="stats-chart-bar-wrap">
                    <div className="stats-chart-bar" style={{height: `${heightPct}%`}} />
                  </div>
                  <span className="stats-chart-label">{monthLabel(key)}</span>
                </div>
              )
            })}
          </div>
        </section>

        {/* Per-topic table */}
        <section className="stats-section">
          <h2 className="stats-section-title">Topics — worst progress first</h2>
          {topicRows.length === 0 ? (
            <div className="stats-empty">No topics with words yet.</div>
          ) : (
            <div className="stats-topic-table">
              <div className="stats-topic-header">
                <span>Topic</span>
                <span className="stats-col-center">Words</span>
                <span className="stats-col-right">Progress</span>
              </div>
              {topicRows.map((row) => (
                <div key={row.id} className="stats-topic-row" onClick={() => navigate(`/topics/${row.slug}`)}>
                  <span className="stats-topic-name">{row.name}</span>
                  <span className="stats-col-center stats-topic-count">{row.total}</span>
                  <div className="stats-topic-progress-wrap">
                    <span className="stats-topic-pct">{row.hasActive ? `${row.progress}%` : '—'}</span>
                    {row.hasActive && (
                      <div className="stats-topic-bar">
                        <div className="stats-topic-bar-fill" style={{width: `${row.progress}%`}} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
