import {useEffect, useMemo, useState} from 'react'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {fetchTopics, fetchWords, type Word, type WordKnowledgeLevel, updateWordKnowledgeLevel} from '../lib/api'
import {filterAndSort, buildLevelSummary, type SortOption} from '../lib/words'

const MOBILE_BREAKPOINT = 860
const PAGE_SIZE_DESKTOP = 20
const PAGE_SIZE_MOBILE  = 12

function getPageSize() {
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches
    ? PAGE_SIZE_MOBILE
    : PAGE_SIZE_DESKTOP
}

export function useStudyState() {
  const queryClient = useQueryClient()

  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null)
  const [topicSearch, setTopicSearch]         = useState('')
  const [wordSearch, setWordSearch]           = useState('')
  const [levelFilter, setLevelFilter]         = useState<'all' | WordKnowledgeLevel>('all')
  const [sortBy, setSortBy]                   = useState<SortOption>('level-asc')
  const [drawerOpen, setDrawerOpen]           = useState(false)
  const [frozenIds, setFrozenIds]             = useState<number[] | null>(null)
  const [page, setPage]                       = useState(1)
  const [pageSize, setPageSize]               = useState(getPageSize)

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`)
    const handler = () => { setPageSize(mq.matches ? PAGE_SIZE_MOBILE : PAGE_SIZE_DESKTOP); setPage(1) }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const topicsQuery = useQuery({queryKey: ['topics'], queryFn: fetchTopics})
  const wordsQuery  = useQuery({queryKey: ['words'],  queryFn: () => fetchWords()})

  const topics = topicsQuery.data ?? []
  const words  = wordsQuery.data  ?? []

  // Auto-select first topic
  useEffect(() => {
    if (!topics.length) return
    if (selectedTopicId === null || !topics.some((t) => t.id === selectedTopicId)) {
      setSelectedTopicId(topics[0].id)
    }
  }, [topics, selectedTopicId])

  // Reset frozen order and page when filters change
  useEffect(() => { setFrozenIds(null); setPage(1) }, [selectedTopicId, wordSearch, levelFilter, sortBy])

  const topicCounts = useMemo(() => {
    const m = new Map<number, number>()
    for (const w of words) m.set(w.topic_id, (m.get(w.topic_id) ?? 0) + 1)
    return m
  }, [words])

  const visibleTopics = useMemo(() => {
    const needle = topicSearch.toLowerCase().trim()
    return topics.filter((t) =>
      !needle ||
      t.name.toLowerCase().includes(needle) ||
      (t.description ?? '').toLowerCase().includes(needle),
    )
  }, [topicSearch, topics])

  const selectedTopic = useMemo(
    () => topics.find((t) => t.id === selectedTopicId) ?? null,
    [topics, selectedTopicId],
  )

  const topicWords = useMemo(
    () => words.filter((w) => w.topic_id === selectedTopicId),
    [words, selectedTopicId],
  )

  const levelSummary = useMemo(() => buildLevelSummary(topicWords), [topicWords])

  const filteredWords = useMemo(
    () => filterAndSort(topicWords, wordSearch, levelFilter, sortBy, frozenIds),
    [topicWords, wordSearch, levelFilter, sortBy, frozenIds],
  )

  const totalPages = Math.max(1, Math.ceil(filteredWords.length / pageSize))
  const safePage   = Math.min(page, totalPages)
  const pageWords  = useMemo(
    () => filteredWords.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filteredWords, safePage, pageSize],
  )

  const updateMutation = useMutation({
    mutationFn: ({wordId, knowledgeLevel}: {wordId: number; knowledgeLevel: WordKnowledgeLevel}) =>
      updateWordKnowledgeLevel(wordId, knowledgeLevel),
    onMutate: async ({wordId, knowledgeLevel}) => {
      setFrozenIds((cur) => cur ?? filteredWords.map((w) => w.id))
      await queryClient.cancelQueries({queryKey: ['words']})
      const prev = queryClient.getQueryData<Word[]>(['words'])
      queryClient.setQueryData<Word[]>(['words'], (cur = []) =>
        cur.map((w) => w.id === wordId ? {...w, knowledge_level: knowledgeLevel} : w),
      )
      return {prev}
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['words'], ctx.prev)
    },
    onSettled: () => queryClient.invalidateQueries({queryKey: ['words']}),
  })

  const resetFilters = () => { setWordSearch(''); setLevelFilter('all'); setSortBy('level-asc') }

  return {
    // data
    topics, words, visibleTopics, selectedTopic, topicWords, topicCounts, levelSummary, filteredWords, pageWords,
    // filters
    topicSearch, setTopicSearch,
    wordSearch, setWordSearch,
    levelFilter, setLevelFilter,
    sortBy, setSortBy,
    resetFilters,
    // selection
    selectedTopicId,
    selectTopic: (id: number) => { setSelectedTopicId(id); setDrawerOpen(false) },
    // ui
    drawerOpen, setDrawerOpen,
    // pagination
    page: safePage, totalPages, setPage,
    // mutation
    updateLevel: (wordId: number, knowledgeLevel: WordKnowledgeLevel) =>
      updateMutation.mutate({wordId, knowledgeLevel}),
    pendingWordId: updateMutation.isPending ? (updateMutation.variables?.wordId ?? null) : null,
    // loading
    isLoading: topicsQuery.isLoading || wordsQuery.isLoading,
  }
}
