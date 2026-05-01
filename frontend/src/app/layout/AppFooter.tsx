import {useNavigate} from 'react-router-dom'
import {useQuery} from '@tanstack/react-query'
import {routes} from '@/app/routes'
import {queryKeys} from '@/app/queryKeys'
import {fetchTopics} from '@/features/topics/api/topicsApi'
import {fetchWords} from '@/features/words/api/wordsApi'

export function AppFooter() {
  const navigate = useNavigate()
  const {data: cachedWords} = useQuery({
    queryKey: queryKeys.words,
    queryFn: () => fetchWords(),
    enabled: false,
  })
  const {data: cachedTopics} = useQuery({
    queryKey: queryKeys.topics,
    queryFn: fetchTopics,
    enabled: false,
  })
  const wordCount = cachedWords?.length ?? null
  const topicCount = cachedTopics?.length ?? null

  return (
    <footer className="app-footer">
      <button type="button" className="app-footer-brand" onClick={() => navigate(routes.home)}>Lexora</button>
      <div className="app-footer-stats">
        {wordCount !== null && <span>{wordCount.toLocaleString()} words</span>}
        {topicCount !== null && <span>{topicCount} topics</span>}
      </div>
      <div className="app-footer-right">
        <span>Personal vocabulary app · {new Date().getFullYear()}</span>
      </div>
    </footer>
  )
}
