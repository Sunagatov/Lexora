import {useQuery} from '@tanstack/react-query'
import {queryKeys} from '../app/queryKeys'
import {request} from './http'

export type PublicConfig = {
  trash_retention_days: number
}

export function usePublicConfig() {
  return useQuery({
    queryKey: queryKeys.publicConfig,
    queryFn: () => request<PublicConfig>('/api/config/public'),
    staleTime: Infinity,
  })
}
