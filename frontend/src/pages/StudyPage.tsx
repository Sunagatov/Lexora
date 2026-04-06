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

type SortOption =
  | 'term-asc'
  | 'term-desc'
  | 'level-asc'
  | 'level-desc'
  | 'updated-desc'
  | 'updated-asc'

function normalizeText(value: string | null | undefined): string {
  return value?.toLowerCase().trim() ?? ''
}

function matchesSearch(word: Word, search: string): boolean {
  if (!search.trim()) {
    return true
  }

  const needle = normalizeText(search)

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
    .some((value) => normalizeText(value).includes(needle))
}

function isIrregular(word: Word): boolean {
  return Boolean(word.past_simple || word.past_participle)
}

function getKnowledgeLabel(level: number | null): string {
  switch (level) {
    case 1:
      return 'Weak'
    case 2:
      return 'Basic'
    case 3:
      return 'Okay'
    case 4:
      return 'Strong'
    case 5:
      return 'Strange'
    default:
      return 'Unset'
  }
}

function getKnowledgeClassName(level: number | null): string {
  switch (level) {
    case 1:
      return 'level-1'
    case 2:
      return 'level-2'
    case 3:
      return 'level-3'
    case 4:
      return 'level-4'
    case 5:
      return 'level-5'
    default:
      return 'level-unset'
  }
}

function formatDate(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString()
}

export function StudyPage() {
  const queryClient = useQueryClient()

  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null)
  const [topicSearch, setTopicSearch] = useState('')
  const [wordSearch, setWordSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<'all' | WordKnowledgeLevel>('all')
  const [sortBy, setSortBy] = useState<SortOption>('level-asc')
  const [onlyIrregular, setOnlyIrregular] = useState(false)
  const [isTopicPanelOpen, setIsTopicPanelOpen] = useState(false)
  const [frozenWordOrderIds, setFrozenWordOrderIds] = useState<number[] | null>(null)

  const topicsQuery = useQuery({
    queryKey: ['topics'],
    queryFn: fetchTopics,
  })

  const wordsQuery = useQuery({
    queryKey: ['words'],
    queryFn: () => fetchWords(),
  })

  const topics = topicsQuery.data ?? []
  const words = wordsQuery.data ?? []

  useEffect(() => {
    if (topics.length === 0) {
      return
    }

    const selectedTopicStillExists = topics.some((topic) => topic.id === selectedTopicId)

    if (selectedTopicId === null || !selectedTopicStillExists) {
      setSelectedTopicId(topics[0].id)
    }
  }, [topics, selectedTopicId])

  useEffect(() => {
    setFrozenWordOrderIds(null)
  }, [selectedTopicId, wordSearch, levelFilter, sortBy, onlyIrregular])

  const topicCounts = useMemo(() => {
    const counts = new Map<number, number>()

    for (const word of words) {
      counts.set(word.topic_id, (counts.get(word.topic_id) ?? 0) + 1)
    }

    return counts
  }, [words])

  const visibleTopics = useMemo(() => {
    const needle = normalizeText(topicSearch)

    return topics.filter((topic) => {
      if (!needle) {
        return true
      }

      return (
        normalizeText(topic.name).includes(needle) ||
        normalizeText(topic.description).includes(needle) ||
        normalizeText(topic.slug).includes(needle)
      )
    })
  }, [topicSearch, topics])

  const selectedTopic = useMemo(
    () => topics.find((topic) => topic.id === selectedTopicId) ?? null,
    [topics, selectedTopicId],
  )

  const selectedTopicWords = useMemo(() => {
    if (selectedTopicId === null) {
      return []
    }

    return words.filter((word) => word.topic_id === selectedTopicId)
  }, [selectedTopicId, words])

  const topicSummary = useMemo<Record<WordKnowledgeLevel, number>>(() => {
    const summary: Record<WordKnowledgeLevel, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    }

    for (const word of selectedTopicWords) {
      const level = word.knowledge_level

      if (level && level >= 1 && level <= 5) {
        summary[level as WordKnowledgeLevel] += 1
      }
    }

    return summary
  }, [selectedTopicWords])

  const filteredWords = useMemo(() => {
    const result = selectedTopicWords
      .filter((word) => matchesSearch(word, wordSearch))
      .filter((word) => (levelFilter === 'all' ? true : word.knowledge_level === levelFilter))
      .filter((word) => (onlyIrregular ? isIrregular(word) : true))

    result.sort((left, right) => {
      switch (sortBy) {
        case 'term-asc':
          return left.term.localeCompare(right.term)
        case 'term-desc':
          return right.term.localeCompare(left.term)
        case 'level-asc':
          return (left.knowledge_level ?? 99) - (right.knowledge_level ?? 99)
        case 'level-desc':
          return (right.knowledge_level ?? 0) - (left.knowledge_level ?? 0)
        case 'updated-asc':
          return new Date(left.updated_at).getTime() - new Date(right.updated_at).getTime()
        case 'updated-desc':
          return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
        default:
          return 0
      }
    })

    if (!frozenWordOrderIds) {
      return result
    }

    const frozenOrderIndex = new Map(
      frozenWordOrderIds.map((wordId, index) => [wordId, index]),
    )

    return [...result].sort((left, right) => {
      const leftFrozenIndex = frozenOrderIndex.get(left.id)
      const rightFrozenIndex = frozenOrderIndex.get(right.id)

      if (leftFrozenIndex !== undefined && rightFrozenIndex !== undefined) {
        return leftFrozenIndex - rightFrozenIndex
      }

      if (leftFrozenIndex !== undefined) {
        return -1
      }

      if (rightFrozenIndex !== undefined) {
        return 1
      }

      return 0
    })
  }, [
    selectedTopicWords,
    wordSearch,
    levelFilter,
    onlyIrregular,
    sortBy,
    frozenWordOrderIds,
  ])

  const updateLevelMutation = useMutation({
    mutationFn: ({wordId, knowledgeLevel}: {wordId: number; knowledgeLevel: WordKnowledgeLevel}) =>
      updateWordKnowledgeLevel(wordId, knowledgeLevel),
    onMutate: async ({wordId, knowledgeLevel}) => {
      setFrozenWordOrderIds((current) => current ?? filteredWords.map((word) => word.id))

      await queryClient.cancelQueries({queryKey: ['words']})

      const previousWords = queryClient.getQueryData<Word[]>(['words'])

      queryClient.setQueryData<Word[]>(['words'], (currentWords = []) =>
        currentWords.map((word) =>
          word.id === wordId
            ? {
                ...word,
                knowledge_level: knowledgeLevel,
                updated_at: new Date().toISOString(),
              }
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
    onSettled: async () => {
      await queryClient.invalidateQueries({queryKey: ['words']})
    },
  })

  const pendingWordId = updateLevelMutation.variables?.wordId ?? null

  const resetFilters = () => {
    setWordSearch('')
    setLevelFilter('all')
    setSortBy('level-asc')
    setOnlyIrregular(false)
  }

  if (topicsQuery.isLoading || wordsQuery.isLoading) {
    return <p>Loading study workspace...</p>
  }

  if (topicsQuery.isError || wordsQuery.isError) {
    return <p>Failed to load study workspace.</p>
  }

  return (
    <div className="study-page stack-lg">
      <section className="hero-card">
        <div className="hero-header">
          <div>
            <h2>Study workspace</h2>
            <p className="muted">
              Choose a topic, review its vocabulary, sort quickly, and update knowledge level inline.
            </p>
          </div>

          <div className="hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-label">Topics</span>
              <strong>{topics.length}</strong>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-label">Words</span>
              <strong>{words.length}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="panel-card mobile-only mobile-topic-bar">
        <div className="mobile-topic-bar-row">
          <div>
            <h3 className="mobile-topic-title">{selectedTopic?.name ?? 'Choose topic'}</h3>
            <p className="muted mobile-topic-subtitle">
              {selectedTopicWords.length} words in selected topic
            </p>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={() => setIsTopicPanelOpen((current) => !current)}
          >
            {isTopicPanelOpen ? 'Hide topics' : 'Choose topic'}
          </button>
        </div>
      </section>

      <section className="study-layout">
        <aside
          className={`panel-card topics-panel ${isTopicPanelOpen ? 'topics-panel-open' : ''}`}
        >
          <div className="panel-header">
            <div>
              <h3>Topics</h3>
              <p className="muted">Pick one topic and review its words.</p>
            </div>
          </div>

          <input
            className="field-input"
            type="text"
            placeholder="Search topic..."
            value={topicSearch}
            onChange={(event) => setTopicSearch(event.target.value)}
          />

          <div className="topic-list">
            {visibleTopics.length === 0 ? (
              <div className="empty-state compact-empty-state">
                <p>No topics match your search.</p>
              </div>
            ) : (
              visibleTopics.map((topic) => {
                const isSelected = topic.id === selectedTopicId
                const wordsCount = topicCounts.get(topic.id) ?? 0

                return (
                  <button
                    key={topic.id}
                    type="button"
                    className={isSelected ? 'topic-item topic-item-active' : 'topic-item'}
                    onClick={() => {
                      setSelectedTopicId(topic.id)
                      setIsTopicPanelOpen(false)
                    }}
                  >
                    <div className="topic-item-top">
                      <strong>{topic.name}</strong>
                      <span className="topic-count">{wordsCount}</span>
                    </div>

                    <div className="topic-item-bottom">
                      <span className="muted">{topic.slug}</span>
                      <span className="muted">{topic.is_active ? 'Active' : 'Inactive'}</span>
                    </div>

                    {topic.description ? (
                      <p className="topic-description muted">{topic.description}</p>
                    ) : null}
                  </button>
                )
              })
            )}
          </div>
        </aside>

        <div className="study-main stack-lg">
          <section className="panel-card">
            <div className="selected-topic-header">
              <div>
                <h3>{selectedTopic?.name ?? 'No topic selected'}</h3>
                <p className="muted">
                  {selectedTopic?.description || 'Choose a topic to see its vocabulary list.'}
                </p>
              </div>

              <div className="topic-summary-grid">
                {LEVELS.map((level) => (
                  <div key={level} className={`summary-chip ${getKnowledgeClassName(level)}`}>
                    <span>Level {level}</span>
                    <strong>{topicSummary[level]}</strong>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="panel-card">
            <div className="toolbar">
              <input
                className="field-input field-input-wide"
                type="text"
                placeholder="Search word, translation, example, notes..."
                value={wordSearch}
                onChange={(event) => setWordSearch(event.target.value)}
              />

              <select
                className="field-select"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortOption)}
              >
                <option value="level-asc">Sort: Level ascending</option>
                <option value="level-desc">Sort: Level descending</option>
                <option value="term-asc">Sort: A → Z</option>
                <option value="term-desc">Sort: Z → A</option>
                <option value="updated-desc">Sort: Recently updated</option>
                <option value="updated-asc">Sort: Oldest updated</option>
              </select>

              <select
                className="field-select"
                value={String(levelFilter)}
                onChange={(event) => {
                  const value = event.target.value
                  setLevelFilter(value === 'all' ? 'all' : (Number(value) as WordKnowledgeLevel))
                }}
              >
                <option value="all">All levels</option>
                <option value="1">Level 1</option>
                <option value="2">Level 2</option>
                <option value="3">Level 3</option>
                <option value="4">Level 4</option>
                <option value="5">Level 5</option>
              </select>

              <label className="toggle">
                <input
                  type="checkbox"
                  checked={onlyIrregular}
                  onChange={(event) => setOnlyIrregular(event.target.checked)}
                />
                <span>Irregular only</span>
              </label>

              <button type="button" className="secondary-button" onClick={resetFilters}>
                Reset
              </button>
            </div>

            <div className="results-meta">
              <span>
                Showing <strong>{filteredWords.length}</strong> of{' '}
                <strong>{selectedTopicWords.length}</strong> words
              </span>
            </div>

            {selectedTopicId === null ? (
              <div className="empty-state">
                <p>Select a topic to start reviewing words.</p>
              </div>
            ) : filteredWords.length === 0 ? (
              <div className="empty-state">
                <p>No words match the current filters.</p>
                <p>Try another level, search phrase, or remove the irregular-only filter.</p>
              </div>
            ) : (
              <>
                <div className="word-table-wrap desktop-only">
                  <table className="word-table">
                    <thead>
                      <tr>
                        <th>Word</th>
                        <th>Translation / details</th>
                        <th>Knowledge</th>
                        <th>Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWords.map((word) => {
                        const level = word.knowledge_level
                        const levelClassName = getKnowledgeClassName(level)
                        const isPending = pendingWordId === word.id && updateLevelMutation.isPending

                        return (
                          <tr key={word.id} className={`word-row ${levelClassName}`}>
                            <td className="word-primary-cell">
                              <div className="word-primary">
                                <strong className="word-term">{word.term}</strong>

                                <div className="word-inline-meta">
                                  {word.part_of_speech ? (
                                    <span className="mini-chip">{word.part_of_speech}</span>
                                  ) : null}
                                  {word.countability ? (
                                    <span className="mini-chip">{word.countability}</span>
                                  ) : null}
                                  {word.pattern ? <span className="mini-chip">{word.pattern}</span> : null}
                                </div>
                              </div>
                            </td>

                            <td>
                              <div className="word-details">
                                <div className="word-translation">{word.translations}</div>

                                {(word.past_simple || word.past_participle) && (
                                  <div className="word-extra">
                                    <strong>Irregular:</strong>{' '}
                                    {[word.past_simple, word.past_participle].filter(Boolean).join(' · ')}
                                  </div>
                                )}

                                {word.example ? (
                                  <div className="word-extra">
                                    <strong>Example:</strong> {word.example}
                                  </div>
                                ) : null}

                                {word.notes ? (
                                  <div className="word-extra muted">
                                    <strong>Notes:</strong> {word.notes}
                                  </div>
                                ) : null}
                              </div>
                            </td>

                            <td>
                              <div className="knowledge-cell">
                                <span className={`level-badge ${levelClassName}`}>
                                  {getKnowledgeLabel(level)}
                                </span>

                                <div className="level-switcher">
                                  {LEVELS.map((buttonLevel) => (
                                    <button
                                      key={buttonLevel}
                                      type="button"
                                      className={
                                        buttonLevel === level
                                          ? `level-button level-button-active ${getKnowledgeClassName(buttonLevel)}`
                                          : 'level-button'
                                      }
                                      disabled={isPending}
                                      onClick={() =>
                                        updateLevelMutation.mutate({
                                          wordId: word.id,
                                          knowledgeLevel: buttonLevel,
                                        })
                                      }
                                    >
                                      {buttonLevel}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </td>

                            <td className="muted">{formatDate(word.updated_at)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mobile-only word-card-list">
                  {filteredWords.map((word) => {
                    const level = word.knowledge_level
                    const levelClassName = getKnowledgeClassName(level)
                    const isPending = pendingWordId === word.id && updateLevelMutation.isPending

                    return (
                      <article key={word.id} className={`word-card ${levelClassName}`}>
                        <div className="word-card-header">
                          <div className="word-card-main">
                            <h4 className="word-card-title">{word.term}</h4>

                            <div className="word-inline-meta">
                              {word.part_of_speech ? (
                                <span className="mini-chip">{word.part_of_speech}</span>
                              ) : null}
                              {word.countability ? (
                                <span className="mini-chip">{word.countability}</span>
                              ) : null}
                              {word.pattern ? <span className="mini-chip">{word.pattern}</span> : null}
                            </div>
                          </div>

                          <span className={`level-badge ${levelClassName}`}>
                            {getKnowledgeLabel(level)}
                          </span>
                        </div>

                        <div className="word-card-section">
                          <div className="word-translation">{word.translations}</div>

                          {(word.past_simple || word.past_participle) && (
                            <div className="word-extra">
                              <strong>Irregular:</strong>{' '}
                              {[word.past_simple, word.past_participle].filter(Boolean).join(' · ')}
                            </div>
                          )}

                          {word.example ? (
                            <div className="word-extra">
                              <strong>Example:</strong> {word.example}
                            </div>
                          ) : null}

                          {word.notes ? (
                            <div className="word-extra muted">
                              <strong>Notes:</strong> {word.notes}
                            </div>
                          ) : null}
                        </div>

                        <div className="word-card-footer">
                          <span className="muted">Updated: {formatDate(word.updated_at)}</span>
                        </div>

                        <div className="level-switcher mobile-level-switcher">
                          {LEVELS.map((buttonLevel) => (
                            <button
                              key={buttonLevel}
                              type="button"
                              className={
                                buttonLevel === level
                                  ? `level-button level-button-active ${getKnowledgeClassName(buttonLevel)}`
                                  : 'level-button'
                              }
                              disabled={isPending}
                              onClick={() =>
                                updateLevelMutation.mutate({
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
          </section>
        </div>
      </section>
    </div>
  )
}