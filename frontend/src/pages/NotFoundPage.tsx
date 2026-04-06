import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="stack-lg">
      <h2>Page not found</h2>
      <p>The page you tried to open does not exist.</p>
      <Link to="/" className="button-link">
        Back to home
      </Link>
    </div>
  )
}