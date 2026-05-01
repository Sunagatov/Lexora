import {request} from '@/shared/api/http'
import type {StatsResponse} from '@/features/stats/types/statsTypes'

export const fetchStats = () => request<StatsResponse>('/api/stats')

type UsageEventPayload = {
  event_key: string
  session_key: string
  route: string | null
  active_seconds: number
}

export async function recordUsageEvent(payload: UsageEventPayload): Promise<void> {
  await request<void>('/api/stats/usage', {
    method: 'POST',
    body: JSON.stringify(payload),
    keepalive: true,
  })
}
