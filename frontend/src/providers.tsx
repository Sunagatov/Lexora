import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import type {PropsWithChildren} from 'react'
import {DrawerProvider} from './shared/DrawerContext'
import {ApiError} from './shared/apiError'
import {routes} from './shared/routes'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (_, error: unknown) => !(error instanceof ApiError && error.status === 401),
    },
    mutations: {
      onError: (error: unknown) => {
        if (error instanceof ApiError && error.status === 401) {
          window.location.href = routes.login
        }
      },
    },
  },
})

queryClient.getQueryCache().subscribe((event) => {
  if (event.type === 'updated' && event.query.state.status === 'error') {
    const err: unknown = event.query.state.error
    if (err instanceof ApiError && err.status === 401) {
      window.location.href = routes.login
    }
  }
})

export function Providers({children}: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <DrawerProvider>{children}</DrawerProvider>
    </QueryClientProvider>
  )
}
