import {useEffect, useState} from 'react'
import {MutationCache, QueryClient, QueryClientProvider} from '@tanstack/react-query'
import type {PropsWithChildren} from 'react'
import {DrawerProvider} from './layout/DrawerContext'
import {ApiError} from './shared/apiError'
import {redirectIfUnauthorized} from './features/auth/redirectIfUnauthorized'
import {bootstrapSession} from './features/auth/api'

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error: unknown) => redirectIfUnauthorized(error),
  }),
  defaultOptions: {
    queries: {
      retry: (_, error: unknown) => !(error instanceof ApiError && (error.status === 401 || error.status === 403)),
    },
  },
})

queryClient.getQueryCache().subscribe((event) => {
  if (event.type === 'updated' && event.query.state.status === 'error') {
    redirectIfUnauthorized(event.query.state.error)
  }
})

export function Providers({children}: PropsWithChildren) {
  const [authReady, setAuthReady] = useState(() => Boolean(localStorage.getItem('csrf_token')))

  useEffect(() => {
    if (localStorage.getItem('csrf_token')) {
      setAuthReady(true)
      return
    }

    let cancelled = false
    void bootstrapSession().finally(() => {
      if (!cancelled) setAuthReady(true)
    })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <DrawerProvider>{authReady ? children : null}</DrawerProvider>
    </QueryClientProvider>
  )
}
