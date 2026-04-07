import {useEffect, useMemo, useRef, useState} from 'react'
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

type Topic = {
  id: number
  name: string
  slug?: string | null
  description?: string | null
}

type DropdownOption<T extends string> = {
  value: T
  label: string
}

const LEVEL_LABELS: Record<number, string> = {
  1: 'Weak',
  2: 'Basic',
  3: 'Okay',
  4: 'Strong',
  5: 'Master',
}

const SUMMARY_LABELS: Record<number, string> = {
  1: 'Weak',
  2: 'Basic',
  3: 'Okay',
  4: 'Strong',
  5: 'Master',
}

const ALL_SORT_OPTIONS: DropdownOption<SortOption>[] = [
  {value: 'level-asc', label: 'Level ↑'},
  {value: 'level-desc', label: 'Level ↓'},
  {value: 'term-asc', label: 'A → Z'},
  {value: 'term-desc', label: 'Z → A'},
]

function normalize(v: string | null | undefined) {
  return v?.toLowerCase().trim() ?? ''
}

function levelClass(level: number | null) {
  if (!level) return 'level-unset'
  return `level-${level}`
}

function matchesSearch(word: Word, search: string): boolean {
  if (!search.trim()) return true

  const needle = normalize(search)

  return [
    word.term,
    word.translations,
    word.part_of_speech,
    word.pattern,
    word.example,
    word.notes,
    word.past_simple,
    word.past_participle,
  ]
    .filter(Boolean)
    .some((value) => normalize(value).includes(needle))
}

function CompactDropdown<T extends string>({
  value,
  options,
  onChange,
  className = '',
}: {
  value: T
  options: DropdownOption<T>[]
  onChange: (value: T) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const selected = options.find((option) => option.value === value) ?? options[0]

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  return (
    <div ref={rootRef} className={`dropdown ${open ? 'dropdown-open' : ''} ${className}`.trim()}>
      <button
        type="button"
        className="dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="dropdown-trigger-label">{selected.label}</span>
        <span className="dropdown-trigger-icon" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="dropdown-menu" role="listbox">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`dropdown-option ${option.value === value ? 'dropdown-option-active' : ''}`}
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
            >
              <span>{option.label}</span>
              {option.value === value ? <span className="dropdown-check">✓</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  )
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
  topics: Topic[]
  topicCounts: Map<number, number>
  totalWords: number
  topicSearch: string
  setTopicSearch: (value: string) => void
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
          <div className="sidebar-empty">No topics found.</div>
        ) : (
          topics.map((topic) => (
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

  const topics = (topicsQuery.data ?? []) as Topic[]
  const words = wordsQuery.data ?? []

  useEffect(() => {
    if (!topics.length) return

    if (selectedTopicId === null || !topics.some((topic) => topic.id === selectedTopicId)) {
      setSelectedTopicId(topics[0].id)
    }
  }, [topics, selectedTopicId])

  useEffect(() => {
    if (levelFilter !== 'all' && (sortBy === 'level-asc' || sortBy === 'level-desc')) {
      setSortBy('term-asc')
    }
  }, [levelFilter, sortBy])

  useEffect(() => {
    setFrozenIds(null)
  }, [selectedTopicId, wordSearch, levelFilter, sortBy])

  const topicCounts = useMemo(() => {
    const counts = new Map<number, number>()

    for (const word of words) {
      counts.set(word.topic_id, (counts.get(word.topic_id) ?? 0) + 1)
    }

    return counts
  }, [words])

  const visibleTopics = useMemo(() => {
    const needle = normalize(topicSearch)

    return topics.filter((topic) => {
      return (
        !needle ||
        normalize(topic.name).includes(needle) ||
        normalize(topic.description).includes(needle) ||
        normalize(topic.slug).includes(needle)
      )
    })
  }, [topicSearch, topics])

  const selectedTopic = useMemo(
    () => topics.find((topic) => topic.id === selectedTopicId) ?? null,
    [topics, selectedTopicId],
  )

  const topicWords = useMemo(
    () => (selectedTopicId === null ? [] : words.filter((word) => word.topic_id === selectedTopicId)),
    [selectedTopicId, words],
  )

  const levelSummary = useMemo(() => {
    const summary: Record<WordKnowledgeLevel, number> = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}

    for (const word of topicWords) {
      const level = word.knowledge_level
      if (level && level >= 1 && level <= 5) {
        summary[level as WordKnowledgeLevel]++
      }
    }

    return summary
  }, [topicWords])

  const availableSortOptions = useMemo(() => {
    if (levelFilter !== 'all') {
      return ALL_SORT_OPTIONS.filter((option) => option.value === 'term-asc' || option.value === 'term-desc')
    }

    return ALL_SORT_OPTIONS
  }, [levelFilter])

  const levelFilterOptions: DropdownOption<'all' | `${WordKnowledgeLevel}`>[] = useMemo(
    () => [
      {value: 'all', label: 'All levels'},
      ...LEVELS.map((level) => ({
        value: String(level) as `${WordKnowledgeLevel}`,
        label: `Level ${level} — ${LEVEL_LABELS[level]}`,
      })),
    ],
    [],
  )

  const filteredWords = useMemo(() => {
    const result = topicWords
      .filter((word) => matchesSearch(word, wordSearch))
      .filter((word) => levelFilter === 'all' || word.knowledge_level === levelFilter)

    result.sort((a, b) => {
      switch (sortBy) {
        case 'term-asc':
          return a.term.localeCompare(b.term)
        case 'term-desc':
          return b.term.localeCompare(a.term)
        case 'level-asc':
          return (a.knowledge_level ?? 99) - (b.knowledge_level ?? 99)
        case 'level-desc':
          return (b.knowledge_level ?? 0) - (a.knowledge_level ?? 0)
        default:
          return 0
      }
    })

    if (!frozenIds) {
      return result
    }

    const frozenIndex = new Map(frozenIds.map((id, index) => [id, index]))

    return [...result].sort((a, b) => {
      const aIndex = frozenIndex.get(a.id)
      const bIndex = frozenIndex.get(b.id)

      if (aIndex !== undefined && bIndex !== undefined) return aIndex - bIndex
      if (aIndex !== undefined) return -1
      if (bIndex !== undefined) return 1
      return 0
    })
  }, [topicWords, wordSearch, levelFilter, sortBy, frozenIds])

  const updateMutation = useMutation({
    mutationFn: ({wordId, knowledgeLevel}: {wordId: number; knowledgeLevel: WordKnowledgeLevel}) =>
      updateWordKnowledgeLevel(wordId, knowledgeLevel),

    onMutate: async ({wordId, knowledgeLevel}) => {
      setFrozenIds((current) => current ?? filteredWords.map((word) => word.id))

      await queryClient.cancelQueries({queryKey: ['words']})

      const previousWords = queryClient.getQueryData<Word[]>(['words'])

      queryClient.setQueryData<Word[]>(['words'], (current = []) =>
        current.map((word) =>
          word.id === wordId
            ? {...word, knowledge_level: knowledgeLevel, updated_at: new Date().toISOString()}
            : word,
        ),
      )

      return {previousWords}
    },

    onError: (_error, _variables, context) => {
      if (context?.previousWords) {
        queryClient.setQueryData(['words'], context.previousWords)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({queryKey: ['words']})
    },
  })

  const pendingId = updateMutation.variables?.wordId ?? null

  if (topicsQuery.isLoading || wordsQuery.isLoading) {
    return (
      <div className="study-loading">
        Loading study workspace…
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
    onSelect: (id: number) => {
      setSelectedTopicId(id)
      setDrawerOpen(false)
    },
  }

  return (
    <>
      <div className="mobile-topbar">
        <span className="mobile-brand">Lexora</span>

        <button
          type="button"
          className="mobile-topic-btn"
          onClick={() => setDrawerOpen(true)}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="2" y1="4" x2="14" y2="4" />
            <line x1="2" y1="8" x2="14" y2="8" />
            <line x1="2" y1="12" x2="14" y2="12" />
          </svg>
          <span className="mobile-topic-btn-name">{selectedTopic?.name ?? 'Topics'}</span>
        </button>
      </div>

      <div className={`mobile-drawer-overlay ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(false)} />
      <div className={`mobile-drawer ${drawerOpen ? 'open' : ''}`}>
        <TopicSidebar {...sidebarProps} />
      </div>

      <aside className="sidebar desktop-sidebar">
        <TopicSidebar {...sidebarProps} />
      </aside>

      <div className="main-content">
        <div className="main-inner">
          <div className="sticky-stack">
            <div className="card topic-header-card">
              <div className="topic-header-main">
                <div className="topic-header-title">{selectedTopic?.name ?? 'No topic selected'}</div>
                {selectedTopic?.description ? (
                  <div className="topic-header-desc">{selectedTopic.description}</div>
                ) : null}
              </div>

              <div className="level-summary">
                {LEVELS.map((level) => (
                  <div key={level} className={`level-chip ${levelClass(level)}`}>
                    <span className="level-chip-label">{SUMMARY_LABELS[level]}</span>
                    <span className="level-chip-value">{levelSummary[level]}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card toolbar-card">
              <div className="toolbar-search-row">
                <input
                  className="search-input"
                  type="text"
                  placeholder="Search word, translation, example, notes…"
                  value={wordSearch}
                  onChange={(e) => setWordSearch(e.target.value)}
                />
              </div>

              <div className="toolbar-controls-row">
                <CompactDropdown
                  value={sortBy}
                  options={availableSortOptions}
                  onChange={setSortBy}
                  className="toolbar-control"
                />

                <CompactDropdown
                  value={levelFilter === 'all' ? 'all' : String(levelFilter) as `${WordKnowledgeLevel}`}
                  options={levelFilterOptions}
                  onChange={(value) => {
                    setLevelFilter(value === 'all' ? 'all' : (Number(value) as WordKnowledgeLevel))
                  }}
                  className="toolbar-control"
                />

                <button
                  type="button"
                  className="btn btn-ghost btn-reset"
                  onClick={() => {
                    setWordSearch('')
                    setLevelFilter('all')
                    setSortBy('level-asc')
                  }}
                >
                  Reset
                </button>
              </div>

              <div className="toolbar-meta-row">
                <span className="results-meta">
                  <strong>{filteredWords.length}</strong> / <strong>{topicWords.length}</strong> words
                </span>
              </div>
            </div>
          </div>

          {selectedTopicId === null ? (
            <div className="empty-state">Select a topic to start reviewing words.</div>
          ) : filteredWords.length === 0 ? (
            <div className="empty-state">No words match the current filters.</div>
          ) : (
            <>
              <div className="card desktop-word-table-card">
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
                        const currentLevelClass = levelClass(word.knowledge_level)
                        const isPending = pendingId === word.id && updateMutation.isPending

                        return (
                          <tr key={word.id} className={`word-row ${currentLevelClass}`}>
                            <td className="word-cell-word">
                              <strong className="word-term">{word.term}</strong>

                              <div className="word-chips">
                                {word.part_of_speech ? <span className="chip">{word.part_of_speech}</span> : null}
                                {word.countability ? <span className="chip">{word.countability}</span> : null}
                                {word.pattern ? <span className="chip">{word.pattern}</span> : null}
                              </div>
                            </td>

                            <td className="word-cell-details">
                              <div className="word-translation">{word.translations}</div>

                              {word.past_simple || word.past_participle ? (
                                <div className="word-extra">
                                  <strong>Irregular:</strong>{' '}
                                  {[word.past_simple, word.past_participle].filter(Boolean).join(' · ')}
                                </div>
                              ) : null}

                              {word.example ? (
                                <div className="word-extra">
                                  <strong>Example:</strong> {word.example}
                                </div>
                              ) : null}

                              {word.notes ? (
                                <div className="word-extra">
                                  <strong>Notes:</strong> {word.notes}
                                </div>
                              ) : null}
                            </td>

                            <td className="word-cell-knowledge">
                              <span className={`level-badge ${currentLevelClass}`}>
                                {LEVEL_LABELS[word.knowledge_level ?? 0] ?? 'Unset'}
                              </span>

                              <div className="level-switcher">
                                {LEVELS.map((buttonLevel) => (
                                  <button
                                    key={buttonLevel}
                                    type="button"
                                    className={`level-btn ${
                                      buttonLevel === word.knowledge_level
                                        ? `level-btn-active ${levelClass(buttonLevel)}`
                                        : ''
                                    }`}
                                    disabled={isPending}
                                    onClick={() =>
                                      updateMutation.mutate({
                                        wordId: word.id,
                                        knowledgeLevel: buttonLevel,
                                      })
                                    }
                                  >
                                    {buttonLevel}
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

              <div className="word-card-list">
                {filteredWords.map((word) => {
                  const currentLevelClass = levelClass(word.knowledge_level)
                  const isPending = pendingId === word.id && updateMutation.isPending

                  return (
                    <article key={word.id} className="word-card">
                      <div className="word-card-header">
                        <div>
                          <strong className="word-term">{word.term}</strong>

                          <div className="word-chips word-chips-mobile">
                            {word.part_of_speech ? <span className="chip">{word.part_of_speech}</span> : null}
                            {word.countability ? <span className="chip">{word.countability}</span> : null}
                            {word.pattern ? <span className="chip">{word.pattern}</span> : null}
                          </div>
                        </div>

                        <span className={`level-badge ${currentLevelClass}`}>
                          {LEVEL_LABELS[word.knowledge_level ?? 0] ?? 'Unset'}
                        </span>
                      </div>

                      <div className="word-card-body">
                        <div className="word-translation">{word.translations}</div>

                        {word.past_simple || word.past_participle ? (
                          <div className="word-extra">
                            <strong>Irregular:</strong>{' '}
                            {[word.past_simple, word.past_participle].filter(Boolean).join(' · ')}
                          </div>
                        ) : null}

                        {word.example ? (
                          <div className="word-extra">
                            <strong>Example:</strong> {word.example}
                          </div>
                        ) : null}

                        {word.notes ? (
                          <div className="word-extra">
                            <strong>Notes:</strong> {word.notes}
                          </div>
                        ) : null}
                      </div>

                      <div className="word-card-switcher">
                        {LEVELS.map((buttonLevel) => (
                          <button
                            key={buttonLevel}
                            type="button"
                            className={`level-btn ${
                              buttonLevel === word.knowledge_level
                                ? `level-btn-active ${levelClass(buttonLevel)}`
                                : ''
                            }`}
                            disabled={isPending}
                            onClick={() =>
                              updateMutation.mutate({
                                wordId: word.id,
                                knowledgeLevel: buttonLevel,
                              })
                            }
                          >
                            {buttonLevel}
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