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

  const topicsQuery   = useQuery({queryKey: ['topics'], queryFn: fetchTopics})
  // All-words query: used only for sidebar counts/progress, not for the word list.
  const allWordsQuery = useQuery({queryKey: ['words'], queryFn: () => fetchWords()})

  const topics = topicsQuery.data  ?? []
  const words  = allWordsQuery.data ?? []

  const topicState  = useTopicState(topics, words)
  const smartReview = useSmartReview(isSmartReview)

  // Fetch words scoped to the selected topic from the server.
  const wordsQuery = useQuery({
    queryKey: ['words', topicState.selectedTopicId],
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
    visibleTopics: topicState.visibleTopics, selectedTopic: topicState.selectedTopic,
    selectedTopicId: topicState.selectedTopicId, topicCounts: topicState.topicCounts, topicProgress: topicState.topicProgress,
    topicSearch: topicState.topicSearch, setTopicSearch: topicState.setTopicSearch,
    selectTopic: topicState.selectTopic, selectSmartReview: topicState.selectSmartReview,
    drawerOpen: topicState.drawerOpen, setDrawerOpen: topicState.setDrawerOpen,
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
