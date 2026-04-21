import {renderHook, waitFor} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import type {ReactNode} from 'react'
import {useWordUpdate} from '../useWordUpdate'
import * as api from '../api'
import {queryKeys} from '../../../shared/queryKeys'
import type {Word} from '../../../shared/types'

vi.mock('../api')

describe('useWordUpdate rollback', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })
    vi.clearAllMocks()
  })

  function wrapper({children}: {children: ReactNode}) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  it('restores exact ["words"] key on failed mutation', async () => {
    const prevData: Word[] = [
      {id: 1, term: 'run', translations: 'бежать', knowledge_level: 2, updated_at: new Date().toISOString()},
    ]

    queryClient.setQueryData(queryKeys.words, prevData)

    vi.mocked(api.updateWordKnowledgeLevel).mockRejectedValueOnce(new Error('Network error'))

    const {result} = renderHook(() => useWordUpdate(() => {}), {wrapper})

    await waitFor(() => {
      result.current.updateLevel(1, 3)
    })

    await waitFor(() => {
      expect(queryClient.getQueryData(queryKeys.words)).toEqual(prevData)
    })
  })

  it('restores topic-scoped ["words", topicId] key on failed mutation', async () => {
    const topicId = 42
    const prevData: Word[] = [
      {id: 1, term: 'run', translations: 'бежать', knowledge_level: 2, updated_at: new Date().toISOString()},
    ]

    queryClient.setQueryData([...queryKeys.words, topicId], prevData)

    vi.mocked(api.updateWordKnowledgeLevel).mockRejectedValueOnce(new Error('Network error'))

    const {result} = renderHook(() => useWordUpdate(() => {}), {wrapper})

    await waitFor(() => {
      result.current.updateLevel(1, 3)
    })

    await waitFor(() => {
      expect(queryClient.getQueryData([...queryKeys.words, topicId])).toEqual(prevData)
    })
  })

  it('restores all ["words", ...] query family on failed mutation', async () => {
    const rootData: Word[] = [{id: 1, term: 'run', translations: 'бежать', knowledge_level: 2, updated_at: new Date().toISOString()}]
    const topic1Data: Word[] = [{id: 2, term: 'walk', translations: 'идти', knowledge_level: 3, updated_at: new Date().toISOString()}]
    const topic2Data: Word[] = [{id: 3, term: 'jump', translations: 'прыгать', knowledge_level: 1, updated_at: new Date().toISOString()}]

    queryClient.setQueryData(queryKeys.words, rootData)
    queryClient.setQueryData([...queryKeys.words, 1], topic1Data)
    queryClient.setQueryData([...queryKeys.words, 2], topic2Data)

    vi.mocked(api.updateWordKnowledgeLevel).mockRejectedValueOnce(new Error('Network error'))

    const {result} = renderHook(() => useWordUpdate(() => {}), {wrapper})

    await waitFor(() => {
      result.current.updateLevel(1, 3)
    })

    await waitFor(() => {
      expect(queryClient.getQueryData(queryKeys.words)).toEqual(rootData)
      expect(queryClient.getQueryData([...queryKeys.words, 1])).toEqual(topic1Data)
      expect(queryClient.getQueryData([...queryKeys.words, 2])).toEqual(topic2Data)
    })
  })
})
