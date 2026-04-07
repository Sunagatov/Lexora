import {useEffect, useMemo, useState} from 'react'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {
  fetchTopics,
  fetchWords,
  type Word,
  type WordKnowledgeLevel,
  updateWordKnowledgeLevel,
} from '../lib/api'

const LEVELS: WordKnowledgeLevel[] = [1, 2, 3, 4, 5]

type SortOption = 'term-asc' | 'term-desc' | 'level-asc' | 'level-desc'

function normalize(v: string | null | undefined) {
  return v?.toLowerCase().trim() ?? ''
}

function matchesSearch(word: Word, search: string): boolean {
  if (!search.trim()) return true
  const needle = normalize(search)
  return [word.term, word.translations, word.part_of_speech, word.pattern, word.example, word.notes, word.past_simple, word.past_participle]
    .filter(Boolean)
    .some((v) => normalize(v).includes(needle))
}

const LEVEL_LABELS: Record<number, string> = {1: 'Weak', 2: 'Basic', 3: 'Okay', 4: 'Strong', 5: 'Master'}
const LEVEL_SHORT: Record<number, string> = {1: 'Weak', 2: 'Basic', 3: 'Okay', 4: 'Strong', 5: 'Master'}

function levelClass(level: number | null) {
  if (!level) return 'level-unset'
  return `level-${level}`
}

function TopicSidebar({
  topics,
  topicCounts,
  totalWords,
  topicSearch,
  setTopicSearch,
  selectedTopicId,
  onSelect,
}: {
  topics: ReturnType<typeof useMemo<any>>
  topicCounts: Map<number, number>
  totalWords: number
  topicSearch: string
  setTopicSearch: (v: string) => void
  selectedTopicId: number | null
  onSelect: (id: number) => void
}) {
  return (
    <>
      <div className="sidebar-brand">
        <div className="sidebar-brand-name">Lexora</div>
        <div className="sidebar-brand-sub">English vocabulary</div>
      </div>

      <div className="sidebar-stats">
        <div className="sidebar-stat">
          <span className="sidebar-stat-value">{topics.length}</span>
          <span className="sidebar-stat-label">Topics</span>
        </div>
        <div className="sidebar-stat">
          <span className="sidebar-stat-value">{totalWords}</span>
          <span className="sidebar-stat-label">Words</span>
        </div>
      </div>

      <div className="sidebar-search-wrap">
        <input
          className="sidebar-search"
          type="text"
          placeholder="Search topics…"
          value={topicSearch}
          onChange={(e) => setTopicSearch(e.target.value)}
        />
      </div>

      <div className="sidebar-topic-list">
        {topics.length === 0 ? (
          <div style={{padding: '16px 12px', color: '#64748b', fontSize: '0.85rem'}}>No topics found.</div>
        ) : (
          topics.map((topic: any) => (
            <button
              key={topic.id}
              type="button"
              className={`topic-item ${topic.id === selectedTopicId ? 'topic-item-active' : ''}`}
              onClick={() => onSelect(topic.id)}
            >
              <span className="topic-item-name">{topic.name}</span>
              <span className="topic-count">{topicCounts.get(topic.id) ?? 0}</span>
            </button>
          ))
        )}
      </div>
    </>
  )
}

export function StudyPage() {
  const queryClient = useQueryClient()

  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null)
  const [topicSearch, setTopicSearch] = useState('')
  const [wordSearch, setWordSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<'all' | WordKnowledgeLevel>('all')
  const [sortBy, setSortBy] = useState<SortOption>('level-asc')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [frozenIds, setFrozenIds] = useState<number[] | null>(null)

  const topicsQuery = useQuery({queryKey: ['topics'], queryFn: fetchTopics})
  const wordsQuery = useQuery({queryKey: ['words'], queryFn: () => fetchWords()})

  const topics = topicsQuery.data ?? []
  const words = wordsQuery.data ?? []

  useEffect(() => {
    if (!topics.length) return
    if (selectedTopicId === null || !topics.some((t) => t.id === selectedTopicId)) {
      setSelectedTopicId(topics[0].id)
    }
  }, [topics, selectedTopicId])

  useEffect(() => { setFrozenIds(null) }, [selectedTopicId, wordSearch, levelFilter, sortBy])

  const topicCounts = useMemo(() => {
    const m = new Map<number, number>()
    for (const w of words) m.set(w.topic_id, (m.get(w.topic_id) ?? 0) + 1)
    return m
  }, [words])

  const visibleTopics = useMemo(() => {
    const needle = normalize(topicSearch)
    return topics.filter((t) =>
      !needle ||
      normalize(t.name).includes(needle) ||
      normalize(t.description).includes(needle) ||
      normalize(t.slug).includes(needle),
    )
  }, [topicSearch, topics])

  const selectedTopic = useMemo(() => topics.find((t) => t.id === selectedTopicId) ?? null, [topics, selectedTopicId])

  const topicWords = useMemo(
    () => (selectedTopicId === null ? [] : words.filter((w) => w.topic_id === selectedTopicId)),
    [selectedTopicId, words],
  )

  const levelSummary = useMemo(() => {
    const s: Record<WordKnowledgeLevel, number> = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for (const w of topicWords) {
      const l = w.knowledge_level
      if (l && l >= 1 && l <= 5) s[l as WordKnowledgeLevel]++
    }
    return s
  }, [topicWords])

  const filteredWords = useMemo(() => {
    const result = topicWords
      .filter((w) => matchesSearch(w, wordSearch))
      .filter((w) => levelFilter === 'all' || w.knowledge_level === levelFilter)

    result.sort((a, b) => {
      switch (sortBy) {
        case 'term-asc': return a.term.localeCompare(b.term)
        case 'term-desc': return b.term.localeCompare(a.term)
        case 'level-asc': return (a.knowledge_level ?? 99) - (b.knowledge_level ?? 99)
        case 'level-desc': return (b.knowledge_level ?? 0) - (a.knowledge_level ?? 0)
        default: return 0
      }
    })

    if (!frozenIds) return result

    const idx = new Map(frozenIds.map((id, i) => [id, i]))
    return [...result].sort((a, b) => {
      const ai = idx.get(a.id)
      const bi = idx.get(b.id)
      if (ai !== undefined && bi !== undefined) return ai - bi
      if (ai !== undefined) return -1
      if (bi !== undefined) return 1
      return 0
    })
  }, [topicWords, wordSearch, levelFilter, sortBy, frozenIds])

  const updateMutation = useMutation({
    mutationFn: ({wordId, knowledgeLevel}: {wordId: number; knowledgeLevel: WordKnowledgeLevel}) =>
      updateWordKnowledgeLevel(wordId, knowledgeLevel),
    onMutate: async ({wordId, knowledgeLevel}) => {
      setFrozenIds((cur) => cur ?? filteredWords.map((w) => w.id))
      await queryClient.cancelQueries({queryKey: ['words']})
      const prev = queryClient.getQueryData<Word[]>(['words'])
      queryClient.setQueryData<Word[]>(['words'], (cur = []) =>
        cur.map((w) => w.id === wordId ? {...w, knowledge_level: knowledgeLevel, updated_at: new Date().toISOString()} : w),
      )
      return {prev}
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) queryClient.setQueryData(['words'], ctx.prev) },
    onSettled: () => queryClient.invalidateQueries({queryKey: ['words']}),
  })

  const pendingId = updateMutation.variables?.wordId ?? null

  if (topicsQuery.isLoading || wordsQuery.isLoading) {
    return (
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#94a3b8', fontSize: '0.9rem'}}>
        Loading…
      </div>
    )
  }

  const sidebarProps = {
    topics: visibleTopics,
    topicCounts,
    totalWords: words.length,
    topicSearch,
    setTopicSearch,
    selectedTopicId,
    onSelect: (id: number) => { setSelectedTopicId(id); setDrawerOpen(false) },
  }

  return (
    <>
      {/* Mobile topbar */}
      <div className="mobile-topbar">
        <span className="mobile-brand">Lexora</span>
        <button type="button" className="mobile-topic-btn" onClick={() => setDrawerOpen(true)}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="14" y2="8"/><line x1="2" y1="12" x2="14" y2="12"/>
          </svg>
          <span className="mobile-topic-btn-name">{selectedTopic?.name ?? 'Topics'}</span>
        </button>
      </div>

      {/* Mobile drawer */}
      <div className={`mobile-drawer-overlay ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(false)} />
      <div className={`mobile-drawer ${drawerOpen ? 'open' : ''}`}>
        <TopicSidebar {...sidebarProps} />
      </div>

      {/* Desktop sidebar — hidden via CSS on mobile, drawer handles it */}
      <aside className="sidebar desktop-sidebar">
        <TopicSidebar {...sidebarProps} />
      </aside>

      {/* Main */}
      <div className="main-content">
        <div className="main-inner">

          {/* Topic header */}
          <div className="card topic-header-card">
            <div>
              <div className="topic-header-title">{selectedTopic?.name ?? 'No topic selected'}</div>
              {selectedTopic?.description && (
                <div className="topic-header-desc">{selectedTopic.description}</div>
              )}
            </div>
            <div className="level-summary">
              {LEVELS.map((l) => (
                <div key={l} className={`level-chip ${levelClass(l)}`}>
                  <span className="level-chip-label">{LEVEL_SHORT[l]}</span>
                  <span className="level-chip-value">{levelSummary[l]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Toolbar */}
          <div className="card toolbar-card">
            <div className="toolbar-row">
              <input
                className="search-input"
                type="text"
                placeholder="Search word, translation, example…"
                value={wordSearch}
                onChange={(e) => setWordSearch(e.target.value)}
              />
            </div>
            <div className="toolbar-row">
              <select className="field-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)}>
                <option value="level-asc">Level ↑</option>
                <option value="level-desc">Level ↓</option>
                <option value="term-asc">A → Z</option>
                <option value="term-desc">Z → A</option>
              </select>
              <select
                className="field-select"
                value={String(levelFilter)}
                onChange={(e) => {
                  const v = e.target.value
                  setLevelFilter(v === 'all' ? 'all' : (Number(v) as WordKnowledgeLevel))
                }}
              >
                <option value="all">All levels</option>
                {LEVELS.map((l) => <option key={l} value={l}>Level {l} — {LEVEL_LABELS[l]}</option>)}
              </select>
              <button type="button" className="btn btn-ghost" onClick={() => { setWordSearch(''); setLevelFilter('all'); setSortBy('level-asc') }}>
                Reset
              </button>
              <span className="results-meta" style={{marginLeft: 'auto'}}>
                <strong>{filteredWords.length}</strong> / <strong>{topicWords.length}</strong> words
              </span>
            </div>
          </div>

          {/* Word list */}
          {selectedTopicId === null ? (
            <div className="empty-state">Select a topic to start reviewing words.</div>
          ) : filteredWords.length === 0 ? (
            <div className="empty-state">No words match the current filters.</div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="card" style={{padding: 0, overflow: 'hidden'}}>
                <div className="word-table-wrap">
                  <table className="word-table">
                    <thead>
                      <tr>
                        <th>Word</th>
                        <th>Translation / details</th>
                        <th>Knowledge</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWords.map((word) => {
                        const lc = levelClass(word.knowledge_level)
                        const isPending = pendingId === word.id && updateMutation.isPending
                        return (
                          <tr key={word.id} className={`word-row ${lc}`}>
                            <td style={{minWidth: 160}}>
                              <strong className="word-term">{word.term}</strong>
                              <div className="word-chips">
                                {word.part_of_speech && <span className="chip">{word.part_of_speech}</span>}
                                {word.countability && <span className="chip">{word.countability}</span>}
                                {word.pattern && <span className="chip">{word.pattern}</span>}
                              </div>
                            </td>
                            <td style={{minWidth: 260}}>
                              <div className="word-translation">{word.translations}</div>
                              {(word.past_simple || word.past_participle) && (
                                <div className="word-extra">
                                  <strong>Irregular:</strong>{' '}
                                  {[word.past_simple, word.past_participle].filter(Boolean).join(' · ')}
                                </div>
                              )}
                              {word.example && <div className="word-extra"><strong>Example:</strong> {word.example}</div>}
                              {word.notes && <div className="word-extra"><strong>Notes:</strong> {word.notes}</div>}
                            </td>
                            <td style={{minWidth: 180}}>
                              <span className={`level-badge ${lc}`}>{LEVEL_LABELS[word.knowledge_level ?? 0] ?? 'Unset'}</span>
                              <div className="level-switcher">
                                {LEVELS.map((bl) => (
                                  <button
                                    key={bl}
                                    type="button"
                                    className={`level-btn ${bl === word.knowledge_level ? `level-btn-active ${levelClass(bl)}` : ''}`}
                                    disabled={isPending}
                                    onClick={() => updateMutation.mutate({wordId: word.id, knowledgeLevel: bl})}
                                  >
                                    {bl}
                                  </button>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile cards */}
              <div className="word-card-list">
                {filteredWords.map((word) => {
                  const lc = levelClass(word.knowledge_level)
                  const isPending = pendingId === word.id && updateMutation.isPending
                  return (
                    <article key={word.id} className="word-card">
                      <div className="word-card-header">
                        <div>
                          <strong className="word-term">{word.term}</strong>
                          <div className="word-chips" style={{marginTop: 5}}>
                            {word.part_of_speech && <span className="chip">{word.part_of_speech}</span>}
                            {word.countability && <span className="chip">{word.countability}</span>}
                            {word.pattern && <span className="chip">{word.pattern}</span>}
                          </div>
                        </div>
                        <span className={`level-badge ${lc}`}>{LEVEL_LABELS[word.knowledge_level ?? 0] ?? 'Unset'}</span>
                      </div>
                      <div className="word-card-body">
                        <div className="word-translation">{word.translations}</div>
                        {(word.past_simple || word.past_participle) && (
                          <div className="word-extra">
                            <strong>Irregular:</strong>{' '}
                            {[word.past_simple, word.past_participle].filter(Boolean).join(' · ')}
                          </div>
                        )}
                        {word.example && <div className="word-extra"><strong>Example:</strong> {word.example}</div>}
                        {word.notes && <div className="word-extra"><strong>Notes:</strong> {word.notes}</div>}
                      </div>
                      <div className="word-card-switcher">
                        {LEVELS.map((bl) => (
                          <button
                            key={bl}
                            type="button"
                            className={`level-btn ${bl === word.knowledge_level ? `level-btn-active ${levelClass(bl)}` : ''}`}
                            disabled={isPending}
                            onClick={() => updateMutation.mutate({wordId: word.id, knowledgeLevel: bl})}
                          >
                            {bl}
                          </button>
                        ))}
                      </div>
                    </article>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
