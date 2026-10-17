import {useEffect, useState} from 'react'
import {MutationCache, QueryClient, QueryClientProvider} from '@tanstack/react-query'
import type {PropsWithChildren} from 'react'
import {routes} from '@/app/routes'
import {ApiError} from '@/shared/api/apiError'
import {redirectIfUnauthorized} from '@/features/auth/lib/redirectIfUnauthorized'
import {bootstrapSession} from '@/features/auth/api/authApi'
import {initializeOffline, syncOffline} from '@/features/offline/offline'

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error: unknown) => redirectIfUnauthorized(error),
  }),
  defaultOptions: {
    mutations: {networkMode: 'always'},
    queries: {
      networkMode: 'always',
      staleTime: 30_000,
      retry: (failureCount, error: unknown) => failureCount < 2
        && !(error instanceof ApiError && (error.status === 401 || error.status === 403)),
    },
  },
})

queryClient.getQueryCache().subscribe((event) => {
  if (event.type === 'updated' && event.query.state.status === 'error') {
    redirectIfUnauthorized(event.query.state.error)
  }
})

function replaceRoute(pathname: string) {
  window.history.replaceState({}, '', pathname)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function Providers({children}: PropsWithChildren) {
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    const bootstrapPromise = initializeOffline((resetLists = false) => {
      // Keep the visible page stable after a rating; navigation can load fresh data.
      void queryClient.invalidateQueries({predicate: query => resetLists || query.queryKey[0] !== 'word-list'})
      if (!resetLists) void queryClient.invalidateQueries({queryKey: ['word-list'], refetchType: 'none'})
    }).then(bootstrapSession)

    bootstrapPromise.then((authenticated) => {
      if (cancelled) return
      const pathname = window.location.pathname
      if (authenticated && pathname === routes.login) {
        replaceRoute(routes.home)
      }
      if (!authenticated && pathname !== routes.login) {
        replaceRoute(routes.login)
      }
      setAuthReady(true)
      if (authenticated) void syncOffline()
    }).catch(() => {
      if (!cancelled) setAuthReady(true)
    })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      {authReady ? children : null}
    </QueryClientProvider>
  )
}
