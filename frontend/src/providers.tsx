import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import type {PropsWithChildren} from 'react'
import {DrawerProvider} from './shared/DrawerContext'

const queryClient = new QueryClient()

export function Providers({children}: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <DrawerProvider>{children}</DrawerProvider>
    </QueryClientProvider>
  )
}