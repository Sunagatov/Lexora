import {Link, useLocation, useMatch} from 'react-router-dom'
import {useQuery} from '@tanstack/react-query'
import {routes} from '@/app/routes'
import {queryKeys} from '@/app/queryKeys'
import {fetchTopics} from '@/features/topics/api/topicsApi'
import {fetchWord} from '@/features/words/api/wordsApi'
import {resolveWordContextTopic} from '@/features/words/model/wordPageContext'

export function WordRouteBreadcrumb() {
  const location = useLocation()
  const wordMatch = useMatch('/words/:wordId')
  const editWordMatch = useMatch('/words/:wordId/edit')
  const activeMatch = editWordMatch ?? wordMatch
  const wordId = Number(activeMatch?.params.wordId)
  const fromTopicSlug = (location.state as {fromTopicSlug?: string} | null)?.fromTopicSlug
  const isWordRoute = Number.isInteger(wordId) && wordId > 0

  const {data: word} = useQuery({
    queryKey: isWordRoute ? queryKeys.word(wordId) : ['app-header', 'word', 'inactive'],
    queryFn: () => fetchWord(wordId),
    enabled: isWordRoute,
  })

  const {data: topics = []} = useQuery({
    queryKey: queryKeys.topics,
    queryFn: fetchTopics,
    enabled: isWordRoute,
  })

  if (!isWordRoute || !word) return null

  const topic = resolveWordContextTopic(word, topics, fromTopicSlug)

  return (
    <nav className="app-header-breadcrumb" aria-label="Breadcrumb">
      <span className="app-header-crumb">Topics</span>
      {topic && (
        <>
          <span className="app-header-crumb-sep" aria-hidden="true">›</span>
          <Link className="app-header-crumb" to={routes.topic(topic.slug)}>{topic.name}</Link>
        </>
      )}
      <span className="app-header-crumb-sep" aria-hidden="true">›</span>
      <span className="app-header-crumb app-header-crumb-current">{word.term}</span>
    </nav>
  )
}
