import {useNavigate} from 'react-router-dom'
import {useQueryClient} from '@tanstack/react-query'
import type {Word, Topic} from '../shared/http'
import {queryKeys} from '../shared/queryKeys'
import {routes} from '../shared/routes'

export function AppFooter() {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const words  = queryClient.getQueryData<Word[]>(queryKeys.words)
  const topics = queryClient.getQueryData<Topic[]>(queryKeys.topics)

  return (
    <footer className="app-footer">
      <button type="button" className="app-footer-brand" onClick={() => navigate(routes.home)}>Lexora</button>
      <div className="app-footer-stats">
        {words  && <span>{words.length.toLocaleString()} words</span>}
        {topics && <span>{topics.length} topics</span>}
      </div>
      <div className="app-footer-right">
        <span>Personal vocabulary app · {new Date().getFullYear()}</span>
      </div>
    </footer>
  )
}
