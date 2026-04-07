import {useMemo} from 'react'
import {useQuery} from '@tanstack/react-query'
import {fetchTopics, fetchWords} from '../lib/api'
import {useTopicState} from './useTopicState'
import {useWordFilter} from './useWordFilter'
import {useWordUpdate} from './useWordUpdate'

export function useStudyState() {
  const topicsQuery = useQuery({queryKey: ['topics'], queryFn: fetchTopics})
  const wordsQuery  = useQuery({queryKey: ['words'],  queryFn: () => fetchWords()})

  const topics = topicsQuery.data ?? []
  const words  = wordsQuery.data  ?? []

  const topic  = useTopicState(topics, words)

  const topicWords = useMemo(
    () => words.filter((w) => w.topic_id === topic.selectedTopicId),
    [words, topic.selectedTopicId],
  )

  const filter = useWordFilter(topicWords, topic.pageSize, topic.selectedTopicId)

  const update = useWordUpdate(() =>
    filter.setFrozenIds((cur) => cur ?? filter.filteredWords.map((w) => w.id)),
  )

  return {
    // data
    topics,
    words,
    topicWords,

    // topic
    visibleTopics:   topic.visibleTopics,
    selectedTopic:   topic.selectedTopic,
    selectedTopicId: topic.selectedTopicId,
    topicCounts:     topic.topicCounts,
    topicPos:        topic.topicPos,
    topicSearch:     topic.topicSearch,
    setTopicSearch:  topic.setTopicSearch,
    selectTopic:     topic.selectTopic,
    drawerOpen:      topic.drawerOpen,
    setDrawerOpen:   topic.setDrawerOpen,

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

    isLoading: topicsQuery.isLoading || wordsQuery.isLoading,
  }
}
