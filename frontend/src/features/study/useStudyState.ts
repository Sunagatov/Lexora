import {useMemo} from 'react'
import {useLocation} from 'react-router-dom'
import {useQuery} from '@tanstack/react-query'
import {fetchTopics} from '../topics/api'
import {fetchWords} from '../words/api'
import {fetchTopicSidebarStats} from '../topics/api'
import {useTopicState} from '../topics/useTopicState'
import {useWordFilter} from '../words/useWordFilter'
import {useWordUpdate} from '../words/useWordUpdate'
import {useSmartReview} from '../smart-review/useSmartReview'
import {queryKeys} from '../../app/queryKeys'
import {routes} from '../../app/routes'
import {useResponsivePageSize} from './useResponsivePageSize'

export function useStudyState() {
  const location      = useLocation()
  const isSmartReview = location.pathname === routes.smartReview

  const topicsQuery   = useQuery({queryKey: queryKeys.topics, queryFn: fetchTopics})
  const sidebarStatsQuery = useQuery({queryKey: queryKeys.topicSidebar, queryFn: fetchTopicSidebarStats})

  const topics = topicsQuery.data  ?? []
  const sidebarStats = sidebarStatsQuery.data ?? {total_words: 0, topic_counts: {}, topic_progress: {}}
  const topicCounts = useMemo(
    () => new Map(Object.entries(sidebarStats.topic_counts).map(([id, count]) => [Number(id), count] as const)),
    [sidebarStats.topic_counts],
  )
  const topicProgress = useMemo(
    () => new Map(Object.entries(sidebarStats.topic_progress).map(([id, progress]) => [Number(id), progress] as const)),
    [sidebarStats.topic_progress],
  )

  const topicState  = useTopicState(topics, topicCounts, topicProgress, topicsQuery.status === 'success')
  const smartReview = useSmartReview(isSmartReview)
  const defaultPageSize = useResponsivePageSize(20, 40)

  // Fetch words scoped to the selected topic from the server.
  const wordsQuery = useQuery({
    queryKey: queryKeys.topicWords(topicState.selectedTopicId ?? 0),
    queryFn: () => fetchWords({topicId: topicState.selectedTopicId!}),
    enabled: topicState.selectedTopicId !== null,
  })

  const topicWords = wordsQuery.data ?? []

  const filter = useWordFilter(topicWords, {defaultPageSize, syncUrl: !isSmartReview})
  const update = useWordUpdate(() =>
    filter.setFrozenIds((cur) => cur ?? filter.filteredWords.map((w) => w.id)),
  )

  return {
    isSmartReview,
    topics, totalWords: sidebarStats.total_words, topicWords,
    selectedTopic: topicState.selectedTopic,
    selectedTopicId: topicState.selectedTopicId, topicCounts: topicState.topicCounts, topicProgress: topicState.topicProgress,
    topicSearch: topicState.topicSearch, setTopicSearch: topicState.setTopicSearch,
    selectTopic: topicState.selectTopic, selectSmartReview: topicState.selectSmartReview,
    wordSearch: filter.wordSearch, setWordSearch: filter.setWordSearch,
    levelFilter: filter.levelFilter, setLevelFilter: filter.setLevelFilter,
    sortBy: filter.sortBy, setSortBy: filter.setSortBy,
    levelSummary: filter.levelSummary, filteredWords: filter.filteredWords,
    pageWords: filter.pageWords, page: filter.page, totalPages: filter.totalPages,
    setPage: filter.setPage, pageSize: filter.pageSize, setPageSize: filter.setPageSize,
    pageStart: filter.pageStart, pageEnd: filter.pageEnd, resetFilters: filter.resetFilters,
    overallWordCount: sidebarStats.total_words, topicWordCount: topicWords.length,
    filteredWordCount: filter.filteredWords.length,
    updateLevel: update.updateLevel, pendingWordId: update.pendingWordId,
    smartQueue: smartReview.queue,
    isLoading: topicsQuery.isLoading || sidebarStatsQuery.isLoading || (isSmartReview && smartReview.isLoading),
    isWordsLoading: wordsQuery.isLoading,
  }
}
