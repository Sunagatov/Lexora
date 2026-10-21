import {useEffect, useMemo, useState} from 'react'
import {useQuery, useQueryClient} from '@tanstack/react-query'
import {Link, useNavigate} from 'react-router-dom'
import type {WordKnowledgeLevel} from '@/features/words/types/wordTypes'
import type {Topic} from '@/features/topics/types/topicTypes'
import {batchUpdateWords} from '@/features/words/api/wordsApi'
import {fetchTopics} from '@/features/topics/api/topicsApi'
import {routes} from '@/app/routes'
import {LEVEL_LABELS, LEVELS, levelClass} from '@/features/words/model/wordDomain'
import {LevelDropdown} from '@/features/words/components/LevelDropdown'
import {WordSummaryContent} from '@/features/words/components/WordSummaryContent'
import {WordCollectionToolbar} from '@/features/words/components/WordCollectionToolbar'
import {WordCardList} from '@/features/words/components/WordCardList'
import {WordPagination} from '@/features/words/components/WordPagination'
import {useVocabulary} from '@/features/words/hooks/useVocabulary'
import {useIsMobile} from '@/shared/hooks/useIsMobile'
import {Breadcrumb} from '@/shared/components/Breadcrumb'
import {EmptyState} from '@/shared/components/EmptyState'
import {SkeletonTable} from '@/shared/components/Skeletons'
import {queryKeys} from '@/app/queryKeys'
import {redirectIfUnauthorized} from '@/features/auth/lib/redirectIfUnauthorized'
import {invalidateWordDependencies, patchWordLevel} from '@/features/words/model/wordCache'
import {useWordListNavigation, useWordListScrollRestore} from '@/features/words/hooks/useWordListNavigation'

export function AllWordsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const s = useVocabulary()
  const {wordSearch: search, posFilter: pos, cefrFilter: cefr, levelFilter: level, completeness, page, pageSize, wordsQuery} = s
  const isMobile = useIsMobile()
  const [actionError, setActionError] = useState<string | null>(null)
  const [selected, setSelected]   = useState<Set<number>>(new Set())
  const [bulkLevel, setBulkLevel] = useState('')
  const [bulkTopic, setBulkTopic] = useState('')
  const [bulkPending, setBulkPending] = useState(false)
  const [openLevelId, setOpenLevelId] = useState<number | null>(null)
  const [levelAnchor, setLevelAnchor] = useState<HTMLElement | null>(null)
  const [pendingWordId, setPendingWordId] = useState<number | null>(null)
  const [speakingId, setSpeakingId] = useState<number | null>(null)

  const topicsQuery = useQuery({queryKey: queryKeys.topics, queryFn: fetchTopics})
  const topics = useMemo(() => topicsQuery.data ?? [], [topicsQuery.data])
  const topicMap = useMemo(() => new Map(topics.map(t => [t.id, t])), [topics])

  const words = useMemo(() => wordsQuery.isPlaceholderData ? [] : wordsQuery.data?.words ?? [], [wordsQuery.data, wordsQuery.isPlaceholderData])
  const total = wordsQuery.data?.total ?? 0
  const wordList = {ids: words.map(word => word.id), offset: (page - 1) * pageSize, total, query: s.listParams}
  const navigation = useWordListNavigation(undefined, wordList)
  const totalPages = s.totalPages
  const loading = wordsQuery.isLoading || wordsQuery.isPlaceholderData
  useWordListScrollRestore(loading)
  const loadError = wordsQuery.isError ? 'Failed to load words. Please try again.'
    : topicsQuery.isError ? 'Failed to load topics. Please try again.'
    : s.summaryQuery.isError ? 'Failed to load vocabulary progress. Please try again.' : null

  useEffect(() => { setSelected(new Set()) }, [words])
  const viewKey = JSON.stringify([search, pos, cefr, level, completeness, page, pageSize, s.sortBy, s.thenSortBy, s.topicFilter])
  useEffect(() => { setActionError(null) }, [viewKey])

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
    setActionError(null)
    try {
      await batchUpdateWords(payload)
      if (payload.knowledge_level) {
        for (const id of payload.word_ids) patchWordLevel(queryClient, id, payload.knowledge_level as WordKnowledgeLevel)
      }
      setBulkLevel('')
      setBulkTopic('')
      setSelected(new Set())
      invalidateWordDependencies(queryClient, [queryKeys.smartReview, ...payload.word_ids.map(queryKeys.word)],
        {preserveWordPages: !!payload.knowledge_level && !payload.add_topic_ids},
      )
    } catch (error) {
      redirectIfUnauthorized(error)
      setActionError('Failed to update selected words. Please try again.')
    } finally { setBulkPending(false) }
  }

  async function handleLevelChange(wordId: number, newLevel: WordKnowledgeLevel) {
    setPendingWordId(wordId)
    setActionError(null)
    try {
      await batchUpdateWords({word_ids: [wordId], knowledge_level: newLevel})
      patchWordLevel(queryClient, wordId, newLevel)
      invalidateWordDependencies(queryClient, [queryKeys.smartReview, queryKeys.word(wordId)], {preserveWordPages: true})
    } catch (error) {
      redirectIfUnauthorized(error)
      setActionError('Failed to update word. Please try again.')
    } finally { setPendingWordId(null) }
  }

  function speak(id: number, term: string) {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(term)
    u.lang = 'en-GB'
    u.rate = 0.92
    u.onstart = () => setSpeakingId(id)
    u.onend = () => setSpeakingId(null)
    u.onerror = () => setSpeakingId(null)
    window.speechSynthesis.speak(u)
  }

  function resetFilters() { s.resetFilters() }

  const hasFilters = !!(search || pos || cefr || level !== 'all' || completeness !== 'all' || s.topicFilter.length)

  return (
    <div className="all-words-page">
      <Breadcrumb items={[{label: 'Home', onClick: () => navigate(routes.home)}, {label: 'All Words', isActive: true}]} />

      <WordCollectionToolbar
        collectionTitle="All words"
        wordSearch={s.wordSearch} setWordSearch={s.setWordSearch}
        sortBy={s.sortBy} setSortBy={s.setSortBy} thenSortBy={s.thenSortBy} setThenSortBy={s.setThenSortBy}
        levelFilter={s.levelFilter} setLevelFilter={s.setLevelFilter}
        posFilter={s.posFilter} setPosFilter={s.setPosFilter}
        cefrFilter={s.cefrFilter} setCefrFilter={s.setCefrFilter}
        topicFilter={s.topicFilter} setTopicFilter={s.setTopicFilter} topics={topics}
        completeness={s.completeness} setCompleteness={s.setCompleteness}
        onLearningSort={s.setLearningSort} onReset={resetFilters}
        totalWordsOverall={s.summaryQuery.data?.total ?? 0} topicTotalCount={s.summaryQuery.data?.total ?? 0}
        filteredCount={total} pageStart={words.length ? (page - 1) * pageSize + 1 : 0} pageEnd={words.length ? (page - 1) * pageSize + words.length : 0}
        levelSummary={{1: s.summaryQuery.data?.level_counts[1] ?? 0, 3: (s.summaryQuery.data?.level_counts[2] ?? 0) + (s.summaryQuery.data?.level_counts[3] ?? 0), 4: s.summaryQuery.data?.level_counts[4] ?? 0, 5: s.summaryQuery.data?.level_counts[5] ?? 0}}
        progressLabel="Whole vocabulary progress"
        progressReady={s.summaryQuery.isSuccess}
      />

      {(loadError || actionError) && (
        <div role="alert" className="wp-save-error">
          {loadError || actionError}
          {loadError && <button type="button" className="btn btn-ghost" onClick={() => {
            void wordsQuery.refetch()
            void topicsQuery.refetch()
            void s.summaryQuery.refetch()
          }}>Retry</button>}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={6} />
      ) : loadError ? null : words.length === 0 ? (
        <EmptyState
          icon={hasFilters ? '🔍' : '📚'}
          title={hasFilters ? 'No words match these filters' : 'No words yet'}
          description={hasFilters ? 'Try broadening your search or clearing some filters.' : 'Start building your library by adding your first word.'}
          variant={hasFilters ? 'info' : 'default'}
          actions={hasFilters ? [{label: 'Reset filters', onClick: resetFilters, variant: 'secondary'}] : [{label: 'Back Home', onClick: () => navigate(routes.home), variant: 'secondary'}]}
        />
      ) : (
        <>
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
                      <span style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                        <Link className="word-term word-term-link" to={routes.word(word.id)} state={navigation.state} onClick={event => navigation.openWord(event, word.id)} style={{display: 'inline', flex: 'none'}}>{word.term}</Link>
                        <button type="button"
                          className={`wdp-speak-btn ripple-btn${speakingId === word.id ? ' is-speaking' : ''}`}
                          style={{marginLeft: 0}}
                          onClick={() => speak(word.id, word.term)}
                          aria-label={`Pronounce ${word.term}`}>
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h3l4-3v10l-4-3H3z"/>
                            {speakingId === word.id
                              ? <path d="M11 6.5a2.5 2.5 0 0 1 0 3"/>
                              : <path d="M12.2 5.2a4 4 0 0 1 0 5.6"/>}
                          </svg>
                        </button>
                      </span>
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
                            onClick={e => { e.stopPropagation(); if (isOpen) { setOpenLevelId(null); return } setLevelAnchor(e.currentTarget); setOpenLevelId(word.id) }}>
                            {LEVEL_LABELS[word.knowledge_level ?? 0] ?? 'Unset'}
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="2,3.5 5,6.5 8,3.5" /></svg>
                          </button>
                        </div>
                        {isOpen && (
                          <LevelDropdown current={word.knowledge_level as WordKnowledgeLevel | null} anchor={levelAnchor!}
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
        {isMobile && <WordCardList words={words} wordList={wordList} pendingWordId={pendingWordId} onUpdate={handleLevelChange} />}
        </>
      )}

      <WordPagination page={page} totalPages={totalPages} pageSize={pageSize} onPage={s.setPage} onPageSize={s.setPageSize} />

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bulk-bar">
          <span className="bulk-bar-count">{selected.size} selected</span>
          <select value={bulkLevel} onChange={e => setBulkLevel(e.target.value)} aria-label="Set level">
            <option value="">Set level…</option>
            {LEVELS.map(l => <option key={l} value={String(l)}>{LEVEL_LABELS[l]}</option>)}
          </select>
          <select value={bulkTopic} onChange={e => setBulkTopic(e.target.value)} aria-label="Add to topic">
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
