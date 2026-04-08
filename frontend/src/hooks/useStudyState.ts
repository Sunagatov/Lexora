import {useMemo} from 'react'
import {useLocation} from 'react-router-dom'
import {useQuery} from '@tanstack/react-query'
import {fetchTopics, fetchWords} from '../lib/api'
import {useTopicState} from './useTopicState'
import {useWordFilter} from './useWordFilter'
import {useWordUpdate} from './useWordUpdate'
import {useSmartReview} from './useSmartReview'

export function useStudyState() {
  const location = useLocation()
  const isSmartReview = location.pathname === '/study/smart-review'

  const topicsQuery = useQuery({queryKey: ['topics'], queryFn: fetchTopics})
  const wordsQuery  = useQuery({queryKey: ['words'],  queryFn: () => fetchWords()})

  const topics = topicsQuery.data ?? []
  const words  = wordsQuery.data  ?? []

  const topic  = useTopicState(topics, words)
  const smartReview = useSmartReview()

  const topicWords = useMemo(
    () => words.filter((w) => w.topic_id === topic.selectedTopicId),
    [words, topic.selectedTopicId],
  )

  const filter = useWordFilter(topicWords, 0, topic.selectedTopicId)

  const update = useWordUpdate(() =>
    filter.setFrozenIds((cur) => cur ?? filter.filteredWords.map((w) => w.id)),
  )

  return {
    // mode
    isSmartReview,

    // data
    topics,
    words,
    topicWords,

    // topic
    visibleTopics:    topic.visibleTopics,
    selectedTopic:    topic.selectedTopic,
    selectedTopicId:  topic.selectedTopicId,
    topicCounts:      topic.topicCounts,
    topicSearch:      topic.topicSearch,
    setTopicSearch:   topic.setTopicSearch,
    selectTopic:      topic.selectTopic,
    selectSmartReview: topic.selectSmartReview,
    drawerOpen:       topic.drawerOpen,
    setDrawerOpen:    topic.setDrawerOpen,

    // filter
    wordSearch:      filter.wordSearch,
    setWordSearch:   filter.setWordSearch,
    levelFilter:     filter.levelFilter,
    setLevelFilter:  filter.setLevelFilter,
    sortBy:          filter.sortBy,
    setSortBy:       filter.setSortBy,
    levelSummary:    filter.levelSummary,
    filteredWords:   filter.filteredWords,
    pageWords:       filter.pageWords,
    page:            filter.page,
    totalPages:      filter.totalPages,
    setPage:         filter.setPage,
    pageSize:        filter.pageSize,
    setPageSize:     filter.setPageSize,
    pageStart:       filter.pageStart,
    pageEnd:         filter.pageEnd,
    resetFilters:    filter.resetFilters,

    // counts
    overallWordCount:  words.length,
    topicWordCount:    topicWords.length,
    filteredWordCount: filter.filteredWords.length,

    // update
    updateLevel:   update.updateLevel,
    pendingWordId: update.pendingWordId,

    // smart review
    smartQueue: smartReview.queue,

    isLoading: topicsQuery.isLoading || wordsQuery.isLoading,
  }
}
