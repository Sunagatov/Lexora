import {useNavigate} from 'react-router-dom'
import {routes} from '@/app/routes'

export function AppFooter() {
  const navigate = useNavigate()

  return (
    <footer className="app-footer">
      <button type="button" className="app-footer-brand" onClick={() => navigate(routes.home)}>Lexora</button>
      <div className="app-footer-right">
        <span>Personal vocabulary app · {new Date().getFullYear()}</span>
      </div>
    </footer>
  )
}
