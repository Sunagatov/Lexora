import {useQuery} from '@tanstack/react-query'

import {fetchTopics} from '../lib/api'

export function TopicsPage() {
  const topicsQuery = useQuery({
    queryKey: ['topics'],
    queryFn: fetchTopics,
  })

  const topics = topicsQuery.data ?? []

  if (topicsQuery.isLoading) {
    return <p>Loading topics...</p>
  }

  if (topicsQuery.isError) {
    return <p>Failed to load topics.</p>
  }

  return (
    <div className="stack-lg">
      <div>
        <h2>Topics</h2>
        <p>These are loaded from `GET /api/topics`.</p>
      </div>

      {topics.length === 0 ? (
        <div className="empty-state">
          <p>No topics yet.</p>
          <p>Create a topic in Swagger UI first.</p>
        </div>
      ) : (
        <div className="grid grid-2">
          {topics.map((topic) => (
            <article key={topic.id} className="card">
              <h3>{topic.name}</h3>
              <p className="muted">Slug: {topic.slug}</p>
              <p>{topic.description || 'No description yet.'}</p>
              <p className="muted">Active: {topic.is_active ? 'Yes' : 'No'}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}