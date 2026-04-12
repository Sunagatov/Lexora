import {useMemo} from 'react'
import {useLocation} from 'react-router-dom'
import {useQuery} from '@tanstack/react-query'
import {fetchTopics} from '../topics/api'
import {fetchWords} from '../words/api'
import {useTopicState} from '../topics/useTopicState'
import {useWordFilter} from '../words/useWordFilter'
import {useWordUpdate} from '../words/useWordUpdate'
import {useSmartReview} from '../smart-review/useSmartReview'

export function useStudyState() {
  const location      = useLocation()
  const isSmartReview = location.pathname === '/smart-review'

  const topicsQuery = useQuery({queryKey: ['topics'], queryFn: fetchTopics})
  const wordsQuery  = useQuery({queryKey: ['words'],  queryFn: () => fetchWords()})

  const topics = topicsQuery.data ?? []
  const words  = wordsQuery.data  ?? []

  const topic       = useTopicState(topics, words)
  const smartReview = useSmartReview(isSmartReview)

  const topicWords = useMemo(
    () => topic.selectedTopicId === null ? [] : words.filter((w) => w.topic_ids.includes(topic.selectedTopicId!)),
    [words, topic.selectedTopicId],
  )

  const filter = useWordFilter(topicWords)
  const update = useWordUpdate(() =>
    filter.setFrozenIds((cur) => cur ?? filter.filteredWords.map((w) => w.id)),
  )

  return {
    isSmartReview,
    topics, words, topicWords,
    visibleTopics: topic.visibleTopics, selectedTopic: topic.selectedTopic,
    selectedTopicId: topic.selectedTopicId, topicCounts: topic.topicCounts, topicProgress: topic.topicProgress,
    topicSearch: topic.topicSearch, setTopicSearch: topic.setTopicSearch,
    selectTopic: topic.selectTopic, selectSmartReview: topic.selectSmartReview,
    drawerOpen: topic.drawerOpen, setDrawerOpen: topic.setDrawerOpen,
    wordSearch: filter.wordSearch, setWordSearch: filter.setWordSearch,
    levelFilter: filter.levelFilter, setLevelFilter: filter.setLevelFilter,
    sortBy: filter.sortBy, setSortBy: filter.setSortBy,
    levelSummary: filter.levelSummary, filteredWords: filter.filteredWords,
    pageWords: filter.pageWords, page: filter.page, totalPages: filter.totalPages,
    setPage: filter.setPage, pageSize: filter.pageSize, setPageSize: filter.setPageSize,
    pageStart: filter.pageStart, pageEnd: filter.pageEnd, resetFilters: filter.resetFilters,
    overallWordCount: words.length, topicWordCount: topicWords.length,
    filteredWordCount: filter.filteredWords.length,
    updateLevel: update.updateLevel, pendingWordId: update.pendingWordId,
    smartQueue: smartReview.queue,
    isLoading: topicsQuery.isLoading || wordsQuery.isLoading,
  }
}
