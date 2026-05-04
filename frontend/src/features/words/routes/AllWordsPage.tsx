import {useCallback, useEffect, useMemo, useState} from 'react'
import {Link, useNavigate, useSearchParams} from 'react-router-dom'
import type {Word, WordKnowledgeLevel} from '@/features/words/types/wordTypes'
import type {Topic} from '@/features/topics/types/topicTypes'
import {fetchWordList, batchUpdateWords} from '@/features/words/api/wordsApi'
import {fetchTopics} from '@/features/topics/api/topicsApi'
import {routes} from '@/app/routes'
import {LEVEL_LABELS, LEVELS, CEFR_LEVELS, POS_VALUES, levelClass} from '@/features/words/model/wordDomain'
import {LevelDropdown, openUpward} from '@/features/words/components/LevelDropdown'
import {WordSummaryContent} from '@/features/words/components/WordSummaryContent'
import {DEFAULT_PAGE_SIZE} from '@/shared/config/pagination'
import {Breadcrumb} from '@/shared/components/Breadcrumb'
import {EmptyState} from '@/shared/components/EmptyState'
import {SkeletonTable} from '@/shared/components/Skeletons'

type PosValue = (typeof POS_VALUES)[number]
type CefrLevel = (typeof CEFR_LEVELS)[number]

const POS_LABELS: Record<PosValue, string> = {
  noun: 'Noun', verb: 'Verb', adjective: 'Adj', adverb: 'Adv',
  phrase: 'Phrase', preposition: 'Prep', 'phrasal verb': 'Phr. verb', other: 'Other',
}

function param(sp: URLSearchParams, key: string): string { return sp.get(key) ?? '' }
function numParam(sp: URLSearchParams, key: string, fallback: number): number {
  const n = parseInt(sp.get(key) ?? '', 10)
  return Number.isFinite(n) && n >= 1 ? n : fallback
}

export function AllWordsPage() {
  const navigate = useNavigate()
  const [sp, setSp] = useSearchParams()
  const search       = param(sp, 'search')
  const pos          = param(sp, 'pos') as PosValue | ''
  const cefr         = param(sp, 'cefr') as CefrLevel | ''
  const level        = param(sp, 'level')
  const completeness = param(sp, 'completeness')
  const page         = numParam(sp, 'page', 1)
  const pageSize     = numParam(sp, 'pageSize', DEFAULT_PAGE_SIZE)

  const [words, setWords]         = useState<Word[]>([])
  const [total, setTotal]         = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [topics, setTopics]       = useState<Topic[]>([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState<Set<number>>(new Set())
  const [bulkLevel, setBulkLevel] = useState('')
  const [bulkTopic, setBulkTopic] = useState('')
  const [bulkPending, setBulkPending] = useState(false)
  const [openLevelId, setOpenLevelId] = useState<number | null>(null)
  const [flipUp, setFlipUp]       = useState(false)
  const [pendingWordId, setPendingWordId] = useState<number | null>(null)

  const topicMap = useMemo(() => new Map(topics.map(t => [t.id, t])), [topics])

  function setParam(key: string, value: string) {
    setSp(prev => {
      const next = new URLSearchParams(prev)
      if (!value) next.delete(key)
      else next.set(key, value)
      if (key !== 'page') next.delete('page')
      return next
    }, {replace: true})
  }

  const loadWords = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchWordList({
        search: search || undefined,
        pos: pos || undefined,
        cefr: cefr || undefined,
        level: level ? Number(level) : undefined,
        completeness: completeness || undefined,
        page, pageSize,
      })
      setWords(res.words)
      setTotal(res.total)
      setTotalPages(res.total_pages)
    } finally { setLoading(false) }
  }, [search, pos, cefr, level, completeness, page, pageSize])

  useEffect(() => { loadWords() }, [loadWords])
  useEffect(() => { fetchTopics().then(setTopics) }, [])
  useEffect(() => { setSelected(new Set()) }, [words])

  const toggleSelect = (id: number) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const toggleAll = () => {
    if (selected.size === words.length) setSelected(new Set())
    else setSelected(new Set(words.map(w => w.id)))
  }

  async function handleBulkApply() {
    if (selected.size === 0) return
    const payload: Parameters<typeof batchUpdateWords>[0] = {word_ids: [...selected]}
    if (bulkLevel) payload.knowledge_level = Number(bulkLevel)
    if (bulkTopic) payload.add_topic_ids = [Number(bulkTopic)]
    if (!payload.knowledge_level && !payload.add_topic_ids) return
    setBulkPending(true)
    try {
      await batchUpdateWords(payload)
      setBulkLevel('')
      setBulkTopic('')
      setSelected(new Set())
      await loadWords()
    } finally { setBulkPending(false) }
  }

  async function handleLevelChange(wordId: number, newLevel: WordKnowledgeLevel) {
    setPendingWordId(wordId)
    try {
      await batchUpdateWords({word_ids: [wordId], knowledge_level: newLevel})
      await loadWords()
    } finally { setPendingWordId(null) }
  }

  function resetFilters() { setSp({}, {replace: true}) }

  const hasFilters = !!(search || pos || cefr || level || completeness)

  return (
    <div className="all-words-page">
      <Breadcrumb items={[{label: 'Home', onClick: () => navigate(routes.home)}, {label: 'All Words', isActive: true}]} />
      <h1>All Words</h1>

      {/* Toolbar */}
      <div className="all-words-toolbar">
        <input className="search-input" type="text" placeholder="Search words…"
          value={search} onChange={e => setParam('search', e.target.value)} />

        <select className="toolbar-control" value={pos} onChange={e => setParam('pos', e.target.value)} aria-label="Filter by POS">
          <option value="">All POS</option>
          {POS_VALUES.map(p => <option key={p} value={p}>{POS_LABELS[p]}</option>)}
        </select>

        <select className="toolbar-control" value={cefr} onChange={e => setParam('cefr', e.target.value)} aria-label="Filter by CEFR">
          <option value="">All CEFR</option>
          {CEFR_LEVELS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select className="toolbar-control" value={level} onChange={e => setParam('level', e.target.value)} aria-label="Filter by level">
          <option value="">All levels</option>
          {LEVELS.map(l => <option key={l} value={String(l)}>{LEVEL_LABELS[l]}</option>)}
        </select>

        <select className="toolbar-control" value={completeness} onChange={e => setParam('completeness', e.target.value)} aria-label="Filter by completeness">
          <option value="">All</option>
          <option value="complete">✓ Complete</option>
          <option value="incomplete">⚠ Incomplete</option>
        </select>

        {hasFilters && <button type="button" className="btn btn-ghost" onClick={resetFilters}>Reset</button>}
        <span className="toolbar-range">{total} word{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={6} />
      ) : words.length === 0 ? (
        <EmptyState
          icon={hasFilters ? '🔍' : '📚'}
          title={hasFilters ? 'No words match these filters' : 'No words yet'}
          description={hasFilters ? 'Try broadening your search or clearing some filters.' : 'Start building your library by adding your first word.'}
          variant={hasFilters ? 'info' : 'default'}
          actions={hasFilters ? [{label: 'Reset filters', onClick: resetFilters, variant: 'secondary'}] : [{label: 'Back Home', onClick: () => navigate(routes.home), variant: 'secondary'}]}
        />
      ) : (
        <div className="word-table-wrap">
          <table className="word-table" aria-label="All words table">
            <thead>
              <tr>
                <th className="word-cell-checkbox">
                  <input type="checkbox" className="bulk-checkbox"
                    checked={selected.size === words.length && words.length > 0}
                    onChange={toggleAll} aria-label="Select all" />
                </th>
                <th style={{width: '20%', padding: '10px 20px', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)'}}>Word</th>
                <th style={{padding: '10px 20px', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)'}}>Details</th>
                <th style={{width: '130px', padding: '10px 20px', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', textAlign: 'right'}}>Level</th>
              </tr>
            </thead>
            <tbody>
              {words.map(word => {
                const lc = levelClass(word.knowledge_level)
                const isOpen = openLevelId === word.id
                const wordTopics = word.topic_ids.map(id => topicMap.get(id)).filter(Boolean) as Topic[]

                return (
                  <tr key={word.id} className={`word-row ${lc}`}>
                    <td className="word-cell-checkbox">
                      <input type="checkbox" className="bulk-checkbox"
                        checked={selected.has(word.id)}
                        onChange={() => toggleSelect(word.id)}
                        aria-label={`Select ${word.term}`} />
                    </td>
                    <td className="word-cell-word">
                      <Link className="word-term word-term-link" to={routes.word(word.id)}>{word.term}</Link>
                      {wordTopics.length > 0 && (
                        <div className="word-chips" style={{marginTop: 4}}>
                          {wordTopics.map(t => (
                            <span key={t.id} className="topic-chip">{t.name}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="word-cell-details">
                      <WordSummaryContent word={word} />
                    </td>
                    <td className="word-cell-knowledge">
                      <div className="word-level-wrap">
                        <div className="level-badge-wrap">
                          <button type="button" className={`level-badge level-badge-btn ${lc}`}
                            disabled={pendingWordId === word.id}
                            onClick={e => { e.stopPropagation(); if (isOpen) { setOpenLevelId(null); return } setFlipUp(openUpward(e.currentTarget)); setOpenLevelId(word.id) }}>
                            {LEVEL_LABELS[word.knowledge_level ?? 0] ?? 'Unset'}
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="2,3.5 5,6.5 8,3.5" /></svg>
                          </button>
                        </div>
                        {isOpen && (
                          <LevelDropdown current={word.knowledge_level as WordKnowledgeLevel | null} flipUp={flipUp}
                            onSelect={l => { handleLevelChange(word.id, l); setOpenLevelId(null) }}
                            onClose={() => setOpenLevelId(null)} />
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="all-words-pagination">
          <button type="button" className="btn btn-ghost" disabled={page <= 1}
            onClick={() => setParam('page', String(page - 1))}>← Prev</button>
          <span>Page {page} of {totalPages}</span>
          <button type="button" className="btn btn-ghost" disabled={page >= totalPages}
            onClick={() => setParam('page', String(page + 1))}>Next →</button>
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bulk-bar">
          <span className="bulk-bar-count">{selected.size} selected</span>
          <select value={bulkLevel} onChange={e => setBulkLevel(e.target.value)} aria-label="Set level">
            <option value="">Set level…</option>
            {LEVELS.map(l => <option key={l} value={String(l)}>{LEVEL_LABELS[l]}</option>)}
          </select>
          <select value={bulkTopic} onChange={e => setBulkTopic(e.target.value)} aria-label="Move to topic">
            <option value="">Add to topic…</option>
            {topics.map(t => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
          </select>
          <button type="button" className="btn btn-primary" disabled={bulkPending || (!bulkLevel && !bulkTopic)}
            onClick={handleBulkApply}>{bulkPending ? 'Applying…' : 'Apply'}</button>
          <button type="button" className="btn btn-ghost" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}
    </div>
  )
}
