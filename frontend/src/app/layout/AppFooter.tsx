import {useNavigate} from 'react-router-dom'
import {useQuery} from '@tanstack/react-query'
import {fetchTopics} from '@/features/topics/api/topicsApi'
import {fetchWords} from '@/features/words/api/wordsApi'
import {queryKeys} from '@/app/queryKeys'
import {routes} from '@/app/routes'

export function AppFooter() {
  const navigate = useNavigate()
  const wordsQuery = useQuery({queryKey: queryKeys.words, queryFn: () => fetchWords()})
  const topicsQuery = useQuery({queryKey: queryKeys.topics, queryFn: fetchTopics})

  return (
    <footer className="app-footer">
      <button type="button" className="app-footer-brand" onClick={() => navigate(routes.home)}>Lexora</button>
      <div className="app-footer-stats">
        {wordsQuery.data && <span>{wordsQuery.data.length.toLocaleString()} words</span>}
        {topicsQuery.data && <span>{topicsQuery.data.length} topics</span>}
      </div>
      <div className="app-footer-right">
        <span>Personal vocabulary app · {new Date().getFullYear()}</span>
      </div>
    </footer>
  )
}
