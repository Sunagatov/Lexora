import {useQuery} from '@tanstack/react-query'

import {fetchWords} from '../lib/api'

export function WordsPage() {
  const wordsQuery = useQuery({
    queryKey: ['words'],
    queryFn: fetchWords,
  })

  const words = wordsQuery.data ?? []

  if (wordsQuery.isLoading) {
    return <p>Loading words...</p>
  }

  if (wordsQuery.isError) {
    return <p>Failed to load words.</p>
  }

  return (
    <div className="stack-lg">
      <div>
        <h2>Words</h2>
        <p>These are loaded from `GET /api/words`.</p>
      </div>

      {words.length === 0 ? (
        <div className="empty-state">
          <p>No words yet.</p>
          <p>Create a topic and a word in Swagger UI first.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Topic ID</th>
                <th>Term</th>
                <th>Translations</th>
                <th>Part of speech</th>
                <th>Knowledge</th>
              </tr>
            </thead>
            <tbody>
              {words.map((word) => (
                <tr key={word.id}>
                  <td>{word.id}</td>
                  <td>{word.topic_id}</td>
                  <td>{word.term}</td>
                  <td>{word.translations}</td>
                  <td>{word.part_of_speech || '—'}</td>
                  <td>{word.knowledge_level ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}