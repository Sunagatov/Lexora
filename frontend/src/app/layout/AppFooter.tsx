import {useNavigate} from 'react-router-dom'
import {routes} from '@/app/routes'
import {useLibrarySummary} from '@/app/layout/useLibrarySummary'

export function AppFooter() {
  const navigate = useNavigate()
  const {wordCount, topicCount} = useLibrarySummary()

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
