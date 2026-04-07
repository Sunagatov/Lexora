import {useQuery} from '@tanstack/react-query'
import {Link} from 'react-router-dom'

import {fetchHealth, fetchTopics, fetchWords} from '../lib/api'

export function HomePage() {
  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
  })

  const topicsQuery = useQuery({
    queryKey: ['topics'],
    queryFn: fetchTopics,
  })

  const wordsQuery = useQuery({
    queryKey: ['words'],
    queryFn: () => fetchWords(),
  })

  return (
    <div className="stack-lg">
      <section className="hero-card">
        <h2>Welcome to Lexora</h2>
        <p>
          This is the first frontend slice. It already talks to the backend and displays real data.
        </p>
      </section>

      <section className="grid grid-3">
        <article className="stat-card">
          <h3>Backend status</h3>
          <p className="stat-value">
            {healthQuery.isLoading && 'Loading...'}
            {healthQuery.isError && 'Error'}
            {healthQuery.data?.status ?? ''}
          </p>
        </article>

        <article className="stat-card">
          <h3>Topics</h3>
          <p className="stat-value">
            {topicsQuery.isLoading && 'Loading...'}
            {topicsQuery.isError && 'Error'}
            {topicsQuery.data ? topicsQuery.data.length : ''}
          </p>
        </article>

        <article className="stat-card">
          <h3>Words</h3>
          <p className="stat-value">
            {wordsQuery.isLoading && 'Loading...'}
            {wordsQuery.isError && 'Error'}
            {wordsQuery.data ? wordsQuery.data.length : ''}
          </p>
        </article>
      </section>

      <section className="grid grid-2">
        <Link to="/topics" className="card-link">
          <h3>Open Topics</h3>
          <p>See all vocabulary topics returned by the FastAPI backend.</p>
        </Link>

        <Link to="/words" className="card-link">
          <h3>Open Words</h3>
          <p>See all words returned by the FastAPI backend.</p>
        </Link>
      </section>
    </div>
  )
}