import type {EnrichmentCoverage, VocabProfileSummary} from '@/features/stats/types/statsTypes'
import {DonutChart, SectionTitle} from '@/features/stats/components/StatsComponents'

const CEFR_COLORS: Record<string, string> = {
  A1: '#10b981', A2: '#34d399',
  B1: '#2563eb', B2: '#7c3aed',
  C1: '#d97706', C2: '#dc2626',
  unknown: '#e2e8f0',
}

const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'unknown']

const REGISTER_COLORS: Record<string, string> = {
  neutral: '#6366f1', formal: '#2563eb', informal: '#f59e0b',
  slang: '#ef4444', technical: '#8b5cf6', unknown: '#e2e8f0',
}

const POS_COLORS: Record<string, string> = {
  noun: '#6366f1', verb: '#2563eb', adjective: '#10b981',
  adverb: '#f59e0b', preposition: '#8b5cf6', conjunction: '#ec4899',
  pronoun: '#14b8a6', interjection: '#f97316', determiner: '#64748b',
  'phrasal verb': '#0ea5e9', unknown: '#e2e8f0',
}

function DistributionBar({data, colorMap, order}: {
  data: Record<string, number>
  colorMap: Record<string, string>
  order?: string[]
}) {
  const total = Object.values(data).reduce((s, v) => s + v, 0)
  if (total === 0) return null
  const keys = order
    ? order.filter(k => (data[k] ?? 0) > 0)
    : Object.keys(data).sort((a, b) => (data[b] ?? 0) - (data[a] ?? 0)).filter(k => data[k] > 0)

  return (
    <div className="stats-profile-bar-wrap">
      <div className="stats-profile-bar">
        {keys.map(k => (
          <div key={k} className="stats-profile-segment"
            style={{width: `${(data[k] / total) * 100}%`, background: colorMap[k] ?? '#cbd5e1'}}
            title={`${k}: ${data[k]}`} />
        ))}
      </div>
      <div className="stats-profile-legend">
        {keys.map(k => (
          <div key={k} className="stats-profile-legend-item">
            <span className="stats-legend-dot" style={{background: colorMap[k] ?? '#cbd5e1'}} />
            <span className="stats-profile-legend-label">{k === 'unknown' ? 'Not set' : k}</span>
            <span className="stats-profile-legend-count">{data[k]}</span>
            <span className="stats-profile-legend-pct">{Math.round((data[k] / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function VocabProfileSection({profile, totalWords}: {profile: VocabProfileSummary; totalWords: number}) {
  if (totalWords === 0) return null

  const posSlices = Object.entries(profile.pos_distribution)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([k, v]) => ({value: v, color: POS_COLORS[k] ?? '#cbd5e1', label: k === 'unknown' ? 'Not set' : k}))

  const registerSlices = Object.entries(profile.register_distribution)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([k, v]) => ({value: v, color: REGISTER_COLORS[k] ?? '#cbd5e1', label: k === 'unknown' ? 'Not set' : k}))

  return (
    <section className="stats-section stats-section-gradient">
      <SectionTitle icon="🎓" subtitle="CEFR levels, register, and parts of speech across your vocabulary">
        Vocabulary profile
      </SectionTitle>

      <div className="stats-profile-block">
        <h3 className="stats-profile-heading">CEFR Level Distribution</h3>
        <DistributionBar data={profile.cefr_distribution} colorMap={CEFR_COLORS} order={CEFR_ORDER} />
      </div>

      <div className="stats-profile-donuts">
        {registerSlices.length > 0 && (
          <div className="stats-profile-donut-block">
            <h3 className="stats-profile-heading">Register</h3>
            <DonutChart slices={registerSlices} centerLabel={totalWords.toLocaleString()} centerSub="words" size={130} />
            <div className="stats-profile-donut-legend">
              {registerSlices.map(s => (
                <div key={s.label} className="stats-profile-legend-item">
                  <span className="stats-legend-dot" style={{background: s.color}} />
                  <span className="stats-profile-legend-label">{s.label}</span>
                  <span className="stats-profile-legend-count">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {posSlices.length > 0 && (
          <div className="stats-profile-donut-block">
            <h3 className="stats-profile-heading">Parts of Speech</h3>
            <DonutChart slices={posSlices} centerLabel={totalWords.toLocaleString()} centerSub="words" size={130} />
            <div className="stats-profile-donut-legend">
              {posSlices.map(s => (
                <div key={s.label} className="stats-profile-legend-item">
                  <span className="stats-legend-dot" style={{background: s.color}} />
                  <span className="stats-profile-legend-label">{s.label}</span>
                  <span className="stats-profile-legend-count">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

const ENRICHMENT_FIELDS: {key: keyof EnrichmentCoverage; label: string; icon: string; color: string}[] = [
  {key: 'with_definition', label: 'Definition', icon: '📖', color: '#6366f1'},
  {key: 'with_ipa', label: 'IPA', icon: '🔊', color: '#2563eb'},
  {key: 'with_translation', label: 'Translation', icon: '🌍', color: '#0ea5e9'},
  {key: 'with_examples', label: 'Examples', icon: '💡', color: '#10b981'},
  {key: 'with_synonyms', label: 'Synonyms', icon: '🔗', color: '#8b5cf6'},
  {key: 'with_antonyms', label: 'Antonyms', icon: '⚡', color: '#f59e0b'},
  {key: 'with_collocations', label: 'Collocations', icon: '🧩', color: '#ec4899'},
  {key: 'with_confusables', label: 'Confusables', icon: '⚠️', color: '#ef4444'},
  {key: 'with_cefr', label: 'CEFR', icon: '🎓', color: '#14b8a6'},
  {key: 'with_register', label: 'Register', icon: '📋', color: '#64748b'},
]

function RadialRing({pct, color, size = 64, stroke = 5}: {pct: number; color: string; size?: number; stroke?: number}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  return (
    <svg width={size} height={size} className="stats-radial-ring">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)'}} />
    </svg>
  )
}

export function EnrichmentCoverageSection({coverage}: {coverage: EnrichmentCoverage}) {
  if (coverage.total_words === 0) return null
  const total = coverage.total_words
  const filledCount = ENRICHMENT_FIELDS.reduce((s, f) => s + (coverage[f.key] as number), 0)
  const overallPct = Math.round((filledCount / (total * ENRICHMENT_FIELDS.length)) * 100)

  return (
    <section className="stats-section stats-section-gradient">
      <SectionTitle icon="✨" subtitle="How complete is your vocabulary data across all enrichment fields">
        Enrichment coverage
      </SectionTitle>

      <div className="stats-enrichment-hero">
        <div className="stats-enrichment-hero-ring">
          <RadialRing pct={overallPct} color="#6366f1" size={100} stroke={8} />
          <span className="stats-enrichment-hero-pct">{overallPct}%</span>
        </div>
        <div className="stats-enrichment-hero-text">
          <span className="stats-enrichment-hero-label">Overall enrichment</span>
          <span className="stats-enrichment-hero-sub">{filledCount.toLocaleString()} of {(total * ENRICHMENT_FIELDS.length).toLocaleString()} fields filled</span>
        </div>
      </div>

      <div className="stats-enrichment-grid">
        {ENRICHMENT_FIELDS.map(f => {
          const count = coverage[f.key] as number
          const pct = Math.round((count / total) * 100)
          return (
            <div key={f.key} className="stats-enrichment-card">
              <div className="stats-enrichment-ring-wrap">
                <RadialRing pct={pct} color={f.color} size={56} stroke={4.5} />
                <span className="stats-enrichment-ring-pct">{pct}%</span>
              </div>
              <div className="stats-enrichment-card-info">
                <span className="stats-enrichment-card-icon">{f.icon}</span>
                <span className="stats-enrichment-card-label">{f.label}</span>
                <span className="stats-enrichment-card-count">{count}/{total}</span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
