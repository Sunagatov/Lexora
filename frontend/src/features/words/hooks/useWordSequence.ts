import {useQuery} from '@tanstack/react-query'
import {queryKeys} from '@/app/queryKeys'
import {fetchWordList, type WordListParams, type WordListResponse} from '@/features/words/api/wordsApi'
import type {WordListContext} from '@/features/words/hooks/useWordListNavigation'

export function useWordSequence(wordId: number, list?: WordListContext) {
  const index = list?.ids.indexOf(wordId) ?? -1
  const query = list?.query
  const page = query?.page ?? 1
  const pageSize = query?.pageSize ?? 50
  const previousQuery = query ? {...query, page: page - 1} : undefined
  const nextQuery = query ? {...query, page: page + 1} : undefined
  const needPrevious = !!query && index === 0 && !!list && list.offset > 0
  const needNext = !!query && !!list && index === list.ids.length - 1 && index >= 0 && list.offset + list.ids.length < list.total

  // The current order is a snapshot of the list the user opened. Fetch only
  // a neighbouring page at a boundary, without downloading the whole library.
  const previous = useQuery({
    queryKey: [...queryKeys.wordList, previousQuery],
    queryFn: () => fetchWordList(previousQuery!), enabled: needPrevious,
    refetchOnMount: false, refetchOnWindowFocus: false, refetchOnReconnect: false,
  })
  const next = useQuery({
    queryKey: [...queryKeys.wordList, nextQuery],
    queryFn: () => fetchWordList(nextQuery!), enabled: needNext,
    refetchOnMount: false, refetchOnWindowFocus: false, refetchOnReconnect: false,
  })

  function pageContext(data: WordListResponse | undefined, params: WordListParams | undefined): WordListContext | undefined {
    if (!data || !params) return undefined
    return {ids: data.words.map(word => word.id), offset: ((params.page ?? 1) - 1) * pageSize, total: data.total, query: params}
  }
  const previousWords = previous.data?.words ?? []

  return {
    currentIndex: index < 0 ? -1 : (list?.offset ?? 0) + index,
    total: list?.total ?? 0,
    previousId: index > 0 ? list?.ids[index - 1] : needPrevious ? previousWords[previousWords.length - 1]?.id : undefined,
    nextId: index >= 0 && index < (list?.ids.length ?? 0) - 1 ? list?.ids[index + 1] : needNext ? next.data?.words[0]?.id : undefined,
    previousContext: needPrevious ? pageContext(previous.data, previousQuery) : list,
    nextContext: needNext ? pageContext(next.data, nextQuery) : list,
    loading: (needPrevious && previous.isLoading) || (needNext && next.isLoading),
    error: (needPrevious && previous.isError) || (needNext && next.isError),
    retry: () => {
      if (needPrevious) void previous.refetch()
      if (needNext) void next.refetch()
    },
  }
}
