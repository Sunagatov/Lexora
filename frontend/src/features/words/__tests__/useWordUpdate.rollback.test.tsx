import {renderHook, waitFor} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import type {ReactNode} from 'react'
import {useWordUpdate} from '@/features/words/hooks/useWordUpdate'
import * as api from '@/features/words/api/wordsApi'
import {queryKeys} from '@/app/queryKeys'
import type {Word} from '@/features/words/types/wordTypes'
import {DEFAULT_WORD_PROGRESS_SOURCE} from '@/features/words/model/wordDomain'

vi.mock('@/features/words/api/wordsApi')
const onMutate = vi.fn()

describe('useWordUpdate rollback', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })
    vi.clearAllMocks()
    onMutate.mockReset()
  })

  function wrapper({children}: {children: ReactNode}) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  function makeWord(id: number, term: string, knowledge_level: Word['knowledge_level']): Word {
    return {
      id,
      topic_ids: [1],
      term,
      past_simple: null,
      past_participle: null,
      translations: term,
      translation_entries: undefined,
      part_of_speech: 'verb',
      knowledge_level,
      countability: null,
      pattern: null,
      example: null,
      example_entries: undefined,
      example_count: 0,
      example_target_count: 3,
      example_status: 'missing',
      needs_example_enrichment: true,
      notes: null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }

  it('restores exact ["words"] key on failed mutation', async () => {
    const prevData: Word[] = [makeWord(1, 'run', 2)]

    queryClient.setQueryData(queryKeys.words, prevData)

    vi.mocked(api.updateWordKnowledgeLevel).mockRejectedValueOnce(new Error('Network error'))

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const {result} = renderHook(() => useWordUpdate(onMutate), {wrapper})

    await waitFor(() => {
      result.current.updateLevel(1, 3)
    })

    await waitFor(() => {
      expect(queryClient.getQueryData(queryKeys.words)).toEqual(prevData)
    })

    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.topicSidebar})
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.stats})
  })

  it('restores topic-scoped ["words", topicId] key on failed mutation', async () => {
    const topicId = 42
    const prevData: Word[] = [makeWord(1, 'run', 2)]

    queryClient.setQueryData([...queryKeys.words, topicId], prevData)

    vi.mocked(api.updateWordKnowledgeLevel).mockRejectedValueOnce(new Error('Network error'))

    const {result} = renderHook(() => useWordUpdate(onMutate), {wrapper})

    await waitFor(() => {
      result.current.updateLevel(1, 3)
    })

    await waitFor(() => {
      expect(queryClient.getQueryData([...queryKeys.words, topicId])).toEqual(prevData)
    })
  })

  it('restores all ["words", ...] query family on failed mutation', async () => {
    const rootData: Word[] = [makeWord(1, 'run', 2)]
    const topic1Data: Word[] = [makeWord(2, 'walk', 3)]
    const topic2Data: Word[] = [makeWord(3, 'jump', 1)]

    queryClient.setQueryData(queryKeys.words, rootData)
    queryClient.setQueryData([...queryKeys.words, 1], topic1Data)
    queryClient.setQueryData([...queryKeys.words, 2], topic2Data)

    vi.mocked(api.updateWordKnowledgeLevel).mockRejectedValueOnce(new Error('Network error'))

    const {result} = renderHook(() => useWordUpdate(onMutate), {wrapper})

    await waitFor(() => {
      result.current.updateLevel(1, 3)
    })

    await waitFor(() => {
      expect(queryClient.getQueryData(queryKeys.words)).toEqual(rootData)
      expect(queryClient.getQueryData([...queryKeys.words, 1])).toEqual(topic1Data)
      expect(queryClient.getQueryData([...queryKeys.words, 2])).toEqual(topic2Data)
    })
  })

  it('invalidates sidebar and stats after a successful level update', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    vi.mocked(api.updateWordKnowledgeLevel).mockResolvedValueOnce(makeWord(1, 'run', 3))

    const {result} = renderHook(() => useWordUpdate(onMutate), {wrapper})

    result.current.updateLevel(1, 3)

    await waitFor(() => {
      expect(api.updateWordKnowledgeLevel).toHaveBeenCalledWith(1, 3, DEFAULT_WORD_PROGRESS_SOURCE)
    })

    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.topicSidebar})
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.stats})
  })
})
