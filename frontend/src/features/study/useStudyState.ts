import {useLocation} from 'react-router-dom'
import {useQuery} from '@tanstack/react-query'
import {fetchTopics} from '../topics/api'
import {fetchWords} from '../words/api'
import {useTopicState} from '../topics/useTopicState'
import {useWordFilter} from '../words/useWordFilter'
import {useWordUpdate} from '../words/useWordUpdate'
import {useSmartReview} from '../smart-review/useSmartReview'
import {queryKeys} from '../../shared/queryKeys'

export function useStudyState() {
  const location      = useLocation()
  const isSmartReview = location.pathname === '/smart-review'

  const topicsQuery   = useQuery({queryKey: queryKeys.topics, queryFn: fetchTopics})
  // All-words query: used only for sidebar counts/progress, not for the word list.
  const allWordsQuery = useQuery({queryKey: queryKeys.words, queryFn: () => fetchWords()})

  const topics = topicsQuery.data  ?? []
  const words  = allWordsQuery.data ?? []

  const topicState  = useTopicState(topics, words)
  const smartReview = useSmartReview(isSmartReview)

  // Fetch words scoped to the selected topic from the server.
  const wordsQuery = useQuery({
    queryKey: queryKeys.topicWords(topicState.selectedTopicId ?? 0),
    queryFn: () => fetchWords({topicId: topicState.selectedTopicId!}),
    enabled: topicState.selectedTopicId !== null,
  })

  const topicWords = wordsQuery.data ?? []

  const filter = useWordFilter(topicWords)
  const update = useWordUpdate(() =>
    filter.setFrozenIds((cur) => cur ?? filter.filteredWords.map((w) => w.id)),
  )

  return {
    isSmartReview,
    topics, words, topicWords,
    selectedTopic: topicState.selectedTopic,
    selectedTopicId: topicState.selectedTopicId, topicCounts: topicState.topicCounts, topicProgress: topicState.topicProgress,
    topicSearch: topicState.topicSearch, setTopicSearch: topicState.setTopicSearch,
    selectTopic: topicState.selectTopic, selectSmartReview: topicState.selectSmartReview,
    recentIds: topicState.recentIds,
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
