import {useEffect, useMemo, useState} from 'react'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {fetchTopics, fetchWords, type Word, type WordKnowledgeLevel, updateWordKnowledgeLevel} from '../lib/api'
import {filterAndSort, buildLevelSummary, type SortOption} from '../lib/words'

export function useStudyState() {
  const queryClient = useQueryClient()

  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null)
  const [topicSearch, setTopicSearch]         = useState('')
  const [wordSearch, setWordSearch]           = useState('')
  const [levelFilter, setLevelFilter]         = useState<'all' | WordKnowledgeLevel>('all')
  const [sortBy, setSortBy]                   = useState<SortOption>('level-asc')
  const [drawerOpen, setDrawerOpen]           = useState(false)
  const [frozenIds, setFrozenIds]             = useState<number[] | null>(null)

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

  // Reset frozen order when filters change
  useEffect(() => { setFrozenIds(null) }, [selectedTopicId, wordSearch, levelFilter, sortBy])

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
    topics, words, visibleTopics, selectedTopic, topicWords, topicCounts, levelSummary, filteredWords,
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
    // mutation
    updateLevel: (wordId: number, knowledgeLevel: WordKnowledgeLevel) =>
      updateMutation.mutate({wordId, knowledgeLevel}),
    pendingWordId: updateMutation.isPending ? (updateMutation.variables?.wordId ?? null) : null,
    // loading
    isLoading: topicsQuery.isLoading || wordsQuery.isLoading,
  }
}
