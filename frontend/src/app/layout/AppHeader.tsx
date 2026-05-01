import {useState} from 'react'
import {useNavigate, useMatch, Link, useLocation} from 'react-router-dom'
import {useQuery, useQueryClient} from '@tanstack/react-query'
import {routes} from '@/app/routes'
import {useDrawer} from '@/app/layout/DrawerContext'
import {logout} from '@/features/auth/api/authApi'
import {fetchWord} from '@/features/words/api/wordsApi'
import {fetchTopics} from '@/features/topics/api/topicsApi'
import {queryKeys} from '@/app/queryKeys'
import {resolveWordContextTopic} from '@/features/words/model/wordPageContext'

function HeaderBreadcrumb() {
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

export function AppHeader() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const {hasDrawer, setDrawerOpen} = useDrawer()
  const [logoutPending, setLogoutPending] = useState(false)

  async function handleLogout() {
    if (logoutPending) return

    setLogoutPending(true)
    try {
      await logout()
      queryClient.clear()
      navigate(routes.login, {replace: true})
    } finally {
      setLogoutPending(false)
    }
  }

  return (
    <header className="app-header">
      <div className="app-header-left">
        <button type="button" className="app-header-brand" onClick={() => navigate(routes.home)}>
          Lexora
        </button>
        <HeaderBreadcrumb />
      </div>
      <div className="app-header-actions">
        <button type="button" className="app-header-logout" onClick={handleLogout} disabled={logoutPending}>
          {logoutPending ? 'Signing out…' : 'Sign out'}
        </button>
        {hasDrawer && (
          <button type="button" className="app-header-burger" onClick={() => setDrawerOpen(true)}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="2" y1="4" x2="16" y2="4" />
              <line x1="2" y1="9" x2="16" y2="9" />
              <line x1="2" y1="14" x2="16" y2="14" />
            </svg>
          </button>
        )}
      </div>
    </header>
  )
}
