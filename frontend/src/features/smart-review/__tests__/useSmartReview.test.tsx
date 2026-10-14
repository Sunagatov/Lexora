import {act, renderHook, waitFor} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import type {ReactNode} from 'react'
import {useSmartReview} from '@/features/smart-review/hooks/useSmartReview'
import {queryKeys} from '@/app/queryKeys'
import * as smartReviewApi from '@/features/smart-review/api/smartReviewApi'
import type {StudyQueue} from '@/features/smart-review/types/studyQueueTypes'

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

  it('does not let an old completion response replace a newly generated set', async () => {
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}})
    const oldQueue: StudyQueue = {id: 1, generated_at: '', expires_at: '', is_active: true, total_count: 2, completed_count: 0, items: []}
    const newQueue = {...oldQueue, id: 2}
    queryClient.setQueryData(queryKeys.smartReview, oldQueue)
    let finishComplete!: (queue: StudyQueue) => void
    vi.mocked(smartReviewApi.completeSmartReviewItem).mockImplementationOnce(() => new Promise(resolve => { finishComplete = resolve }))
    vi.mocked(smartReviewApi.refreshSmartReview).mockResolvedValueOnce(newQueue)
    const {result} = renderHook(() => useSmartReview(false), {wrapper: wrapper(queryClient)})
    act(() => result.current.completeItem(101))
    await waitFor(() => expect(finishComplete).toBeDefined())
    act(() => result.current.refresh())
    await waitFor(() => expect(result.current.queue?.id).toBe(2))
    await act(async () => { finishComplete({...oldQueue, completed_count: 1}) })
    expect(queryClient.getQueryData(queryKeys.smartReview)).toEqual(newQueue)
  })

  it('does not reduce progress when completion responses arrive out of order', async () => {
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}})
    const queue: StudyQueue = {id: 1, generated_at: '', expires_at: '', is_active: true, total_count: 2, completed_count: 0, items: []}
    queryClient.setQueryData(queryKeys.smartReview, queue)
    let finishFirst!: (queue: StudyQueue) => void
    let finishSecond!: (queue: StudyQueue) => void
    vi.mocked(smartReviewApi.completeSmartReviewItem)
      .mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve }))
      .mockImplementationOnce(() => new Promise(resolve => { finishSecond = resolve }))
    const {result} = renderHook(() => useSmartReview(false), {wrapper: wrapper(queryClient)})
    act(() => result.current.completeItem(101))
    await waitFor(() => expect(finishFirst).toBeDefined())
    act(() => result.current.completeItem(102))
    await waitFor(() => expect(finishSecond).toBeDefined())
    await act(async () => { finishSecond({...queue, completed_count: 2}) })
    await act(async () => { finishFirst({...queue, completed_count: 1}) })
    expect(queryClient.getQueryData<StudyQueue>(queryKeys.smartReview)?.completed_count).toBe(2)
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
    expect(result.current.actionError).toContain('review progress')
    vi.mocked(smartReviewApi.completeSmartReviewItem).mockResolvedValueOnce(result.current.queue!)
    act(() => result.current.retryAction())
    await waitFor(() => expect(smartReviewApi.completeSmartReviewItem).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.actionError).toBeNull())
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
    expect(result.current.actionError).toContain('new word mix')
    vi.mocked(smartReviewApi.refreshSmartReview).mockResolvedValueOnce(result.current.queue!)
    act(() => result.current.retryAction())
    await waitFor(() => expect(smartReviewApi.refreshSmartReview).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.actionError).toBeNull())
  })
})
