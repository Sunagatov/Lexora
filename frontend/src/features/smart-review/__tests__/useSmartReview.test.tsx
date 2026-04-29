import {act, renderHook, waitFor} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import type {ReactNode} from 'react'
import {useSmartReview} from '@/features/smart-review/hooks/useSmartReview'
import {queryKeys} from '@/app/queryKeys'
import * as smartReviewApi from '@/features/smart-review/api/smartReviewApi'

vi.mock('@/features/smart-review/api/smartReviewApi')

function wrapper(queryClient: QueryClient) {
  return function Wrapper({children}: {children: ReactNode}) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useSmartReview cache recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(smartReviewApi.fetchSmartReview).mockResolvedValue({
      id: 1,
      generated_at: '2024-01-01T00:00:00Z',
      expires_at: '2024-01-02T00:00:00Z',
      is_active: true,
      total_count: 1,
      completed_count: 0,
      items: [],
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('refetches the queue when completing an item fails', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    vi.mocked(smartReviewApi.completeSmartReviewItem).mockRejectedValueOnce(new Error('stale queue'))

    const {result} = renderHook(() => useSmartReview(), {wrapper: wrapper(queryClient)})

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    act(() => {
      result.current.completeItem(101)
    })

    await waitFor(() => {
      expect(vi.mocked(smartReviewApi.completeSmartReviewItem).mock.calls[0]?.[0]).toBe(101)
    })
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.smartReview})
  })

  it('refetches the queue when refreshing fails', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    vi.mocked(smartReviewApi.refreshSmartReview).mockRejectedValueOnce(new Error('backend unavailable'))

    const {result} = renderHook(() => useSmartReview(), {wrapper: wrapper(queryClient)})

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    act(() => {
      result.current.refresh()
    })

    await waitFor(() => {
      expect(smartReviewApi.refreshSmartReview).toHaveBeenCalledTimes(1)
    })
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.smartReview})
  })
})
