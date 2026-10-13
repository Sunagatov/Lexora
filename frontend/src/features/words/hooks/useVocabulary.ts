import {useEffect} from 'react'
import {useQuery} from '@tanstack/react-query'
import {queryKeys} from '@/app/queryKeys'
import {fetchWordList, fetchWordKnowledgeSummary} from '@/features/words/api/wordsApi'
import {useWordFilterControls} from '@/features/words/hooks/useWordFilterControls'

export function useVocabulary() {
  const controls = useWordFilterControls({defaultPageSize: 50})
  const {wordSearch, levelFilter, posFilter, cefrFilter, topicFilter, sortBy, thenSortBy, completeness, page, pageSize, setPage} = controls
  const listParams = {
    search: wordSearch || undefined, level: levelFilter === 'all' ? undefined : levelFilter,
    pos: posFilter ?? undefined, cefr: cefrFilter ?? undefined, topicIds: topicFilter.length ? topicFilter : undefined,
    completeness: completeness === 'all' ? undefined : completeness,
    sort: sortBy, thenSort: thenSortBy, page, pageSize,
  }
  const wordsQuery = useQuery({
    queryKey: [...queryKeys.wordList, listParams], queryFn: () => fetchWordList(listParams),
    // Keep the current review page stable when returning from a word or another tab.
    // New controls/pages use a new key and fetch the current server ordering.
    refetchOnMount: false, refetchOnWindowFocus: false, refetchOnReconnect: false,
  })
  const summaryQuery = useQuery({queryKey: queryKeys.wordSummary, queryFn: fetchWordKnowledgeSummary})
  const totalPages = Math.max(1, wordsQuery.data?.total_pages ?? 1)
  useEffect(() => {
    if (wordsQuery.isSuccess && page > totalPages) setPage(totalPages)
  }, [wordsQuery.isSuccess, page, totalPages, setPage])
  return {...controls, wordsQuery, summaryQuery, totalPages}
}
