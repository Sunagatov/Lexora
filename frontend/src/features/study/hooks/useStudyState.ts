import {useMemo} from 'react'
import {useLocation} from 'react-router-dom'
import {useQuery} from '@tanstack/react-query'
import {fetchTopicSidebarStats, fetchTopics, type TopicSidebarStats} from '@/features/topics/api/topicsApi'
import {fetchWords} from '@/features/words/api/wordsApi'
import {useTopicState} from '@/features/topics/hooks/useTopicState'
import {useWordFilter} from '@/features/words/hooks/useWordFilter'
import {useWordUpdate} from '@/features/words/hooks/useWordUpdate'
import {useSmartReview} from '@/features/smart-review/hooks/useSmartReview'
import {queryKeys} from '@/app/queryKeys'
import {routes} from '@/app/routes'
import {DEFAULT_PAGE_SIZE} from '@/shared/config/pagination'

const EMPTY_SIDEBAR_STATS: TopicSidebarStats = {
  total_words: 0,
  topic_counts: {},
  topic_progress: {},
}

function buildNumericMap(values: Record<number, number>): Map<number, number> {
  return new Map(
    Object.entries(values).map(([id, value]) => [Number(id), value] as const),
  )
}

export function useStudyState() {
  const location      = useLocation()
  const isSmartReview = location.pathname === routes.smartReview

  const topicsQuery   = useQuery({queryKey: queryKeys.topics, queryFn: fetchTopics})
  const sidebarStatsQuery = useQuery({queryKey: queryKeys.topicSidebar, queryFn: fetchTopicSidebarStats})

  const topics = topicsQuery.data  ?? []
  const sidebarStats = sidebarStatsQuery.data ?? EMPTY_SIDEBAR_STATS
  const topicCounts = useMemo(
    () => buildNumericMap(sidebarStats.topic_counts),
    [sidebarStats.topic_counts],
  )
  const topicProgress = useMemo(
    () => buildNumericMap(sidebarStats.topic_progress),
    [sidebarStats.topic_progress],
  )

  const topicState  = useTopicState(topics, topicCounts, topicProgress, topicsQuery.status === 'success')
  const smartReview = useSmartReview(isSmartReview)
  const defaultPageSize = DEFAULT_PAGE_SIZE

  // Fetch words scoped to the selected topic from the server.
  const wordsQuery = useQuery({
    queryKey: queryKeys.topicWords(topicState.selectedTopicId ?? 0),
    queryFn: () => fetchWords({topicId: topicState.selectedTopicId!}),
    enabled: topicState.selectedTopicId !== null,
  })

  const topicWords = wordsQuery.data ?? []

  const filter = useWordFilter(topicWords, {defaultPageSize, topics, syncUrl: !isSmartReview, isLoading: topicsQuery.isLoading || wordsQuery.isLoading})
  const update = useWordUpdate(() =>
    filter.setFrozenIds((cur) => cur ?? filter.filteredWords.map((w) => w.id)),
  )
  const totalWords = sidebarStats.total_words
  const topicWordCount = topicWords.length
  const filteredWordCount = filter.filteredWords.length
  const isLoading = isSmartReview
    ? smartReview.isLoading
    : topicsQuery.isLoading
  const isWordsLoading = wordsQuery.isLoading

  return {
    isSmartReview,
    topics, totalWords, topicWords,
    selectedTopic: topicState.selectedTopic,
    selectedTopicId: topicState.selectedTopicId, topicCounts: topicState.topicCounts, topicProgress: topicState.topicProgress,
    topicSearch: topicState.topicSearch, setTopicSearch: topicState.setTopicSearch,
    selectTopic: topicState.selectTopic, selectSmartReview: topicState.selectSmartReview,
    wordSearch: filter.wordSearch, setWordSearch: filter.setWordSearch,
    levelFilter: filter.levelFilter, setLevelFilter: filter.setLevelFilter,
    posFilter: filter.posFilter, setPosFilter: filter.setPosFilter,
    cefrFilter: filter.cefrFilter, setCefrFilter: filter.setCefrFilter,
    completeness: filter.completeness, setCompleteness: filter.setCompleteness,
    sortBy: filter.sortBy, setSortBy: filter.setSortBy,
    thenSortBy: filter.thenSortBy, setThenSortBy: filter.setThenSortBy,
    topicFilter: filter.topicFilter, setTopicFilter: filter.setTopicFilter,
    setLearningSort: filter.setLearningSort,
    levelSummary: filter.levelSummary, filteredWords: filter.filteredWords,
    pageWords: filter.pageWords, page: filter.page, totalPages: filter.totalPages,
    setPage: filter.setPage, pageSize: filter.pageSize, setPageSize: filter.setPageSize,
    pageStart: filter.pageStart, pageEnd: filter.pageEnd, resetFilters: filter.resetFilters,
    overallWordCount: totalWords, topicWordCount,
    filteredWordCount,
    updateLevel: update.updateLevel, pendingWordId: update.pendingWordId, pendingWordIds: update.pendingWordIds,
    smartQueue: smartReview.queue,
    isLoading,
    isWordsLoading,
  }
}
