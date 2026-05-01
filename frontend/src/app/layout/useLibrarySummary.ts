import {useQuery} from '@tanstack/react-query'
import {queryKeys} from '@/app/queryKeys'
import {fetchTopics} from '@/features/topics/api/topicsApi'
import {fetchWords} from '@/features/words/api/wordsApi'

export function useLibrarySummary() {
  const wordsQuery = useQuery({queryKey: queryKeys.words, queryFn: () => fetchWords()})
  const topicsQuery = useQuery({queryKey: queryKeys.topics, queryFn: fetchTopics})

  return {
    wordCount: wordsQuery.data?.length ?? null,
    topicCount: topicsQuery.data?.length ?? null,
  }
}
