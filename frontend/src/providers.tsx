import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import type {PropsWithChildren} from 'react'
import {DrawerProvider} from './shared/DrawerContext'
import {ApiError} from './shared/apiError'
import {redirectIfUnauthorized} from './shared/authRedirect'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (_, error: unknown) => !(error instanceof ApiError && (error.status === 401 || error.status === 403)),
    },
    mutations: {
      onError: (error: unknown) => redirectIfUnauthorized(error),
    },
  },
})

queryClient.getQueryCache().subscribe((event) => {
  if (event.type === 'updated' && event.query.state.status === 'error') {
    redirectIfUnauthorized(event.query.state.error)
  }
})

export function Providers({children}: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <DrawerProvider>{children}</DrawerProvider>
    </QueryClientProvider>
  )
}
