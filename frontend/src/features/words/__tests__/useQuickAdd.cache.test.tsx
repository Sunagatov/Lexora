import {act, renderHook, waitFor} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {describe, expect, it, vi, beforeEach} from 'vitest'
import type {ReactNode} from 'react'
import {useQuickAdd} from '@/features/words/hooks/useQuickAdd'
import {queryKeys} from '@/app/queryKeys'
import type {Topic, Word} from '@/shared/types'
import {ApiError} from '@/shared/api/apiError'
import * as topicsApi from '@/features/topics/api/topicsApi'
import * as wordsApi from '@/features/words/api/wordsApi'
import * as quickAddService from '@/features/words/services/quickAddService'

vi.mock('@/features/topics/api/topicsApi')
vi.mock('@/features/words/api/wordsApi')

function makeTopic(id: number, name: string, slug = name.toLowerCase()): Topic {
  return {
    id,
    name,
    slug,
    description: null,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }
}

function makeWord(id: number, term: string): Word {
  return {
    id,
    topic_ids: [1],
    term,
    past_simple: null,
    past_participle: null,
    translations: term,
    translation_entries: undefined,
    part_of_speech: 'verb',
    knowledge_level: 1,
    countability: null,
    pattern: null,
    example: null,
    example_entries: undefined,
    example_count: 0,
    example_target_count: 3,
    example_status: 'missing',
    needs_example_enrichment: false,
    notes: null,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }
}

function wrapper(queryClient: QueryClient) {
  return function Wrapper({children}: {children: ReactNode}) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useQuickAdd cache invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('invalidates words, stats, and smart review after saving a word', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    vi.mocked(topicsApi.fetchTopics).mockResolvedValue([makeTopic(1, 'Inbox'), makeTopic(2, 'Verbs')])
    vi.mocked(wordsApi.quickAddWord).mockResolvedValue(makeWord(10, 'run'))

    const {result} = renderHook(() => useQuickAdd(vi.fn()), {wrapper: wrapper(queryClient)})

    await waitFor(() => {
      expect(result.current.topicsLoading).toBe(false)
    })

    act(() => {
      result.current.setTerm('run')
      result.current.setTranslation('correr')
      result.current.setTopicId(2)
    })

    act(() => {
      result.current.save()
    })

    await waitFor(() => {
      expect(wordsApi.quickAddWord).toHaveBeenCalledWith('run', 'correr', [2])
    })

    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.words})
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.stats})
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.smartReview})
  })

  it('invalidates topics and stats after creating a topic', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    vi.mocked(topicsApi.fetchTopics).mockResolvedValue([makeTopic(1, 'Inbox')])
    vi.mocked(topicsApi.createTopic).mockResolvedValue(makeTopic(2, 'Astronomy', 'astronomy'))

    const {result} = renderHook(() => useQuickAdd(vi.fn()), {wrapper: wrapper(queryClient)})

    await waitFor(() => {
      expect(result.current.topicsLoading).toBe(false)
    })

    act(() => {
      result.current.setNewTopic('Astronomy')
    })

    await waitFor(() => {
      expect(result.current.newTopic).toBe('Astronomy')
    })

    act(() => {
      result.current.createTopic()
    })

    await waitFor(() => {
      expect(topicsApi.createTopic).toHaveBeenCalledWith('Astronomy')
    })

    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.topics})
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.stats})
  })

  it('shows backend topic-create conflict details instead of flattening them in quick add', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })

    vi.mocked(topicsApi.fetchTopics).mockResolvedValue([makeTopic(1, 'Inbox')])
    vi.mocked(topicsApi.createTopic).mockRejectedValue(
      new ApiError(409, "Topic slug 'inbox' is used by a deleted topic — restore or permanently delete it first"),
    )

    const {result} = renderHook(() => useQuickAdd(vi.fn()), {wrapper: wrapper(queryClient)})

    await waitFor(() => {
      expect(result.current.topicsLoading).toBe(false)
    })

    act(() => {
      result.current.setNewTopic('Inbox')
    })

    await waitFor(() => {
      expect(result.current.newTopic).toBe('Inbox')
    })

    act(() => {
      result.current.createTopic()
    })

    await waitFor(() => {
      expect(topicsApi.createTopic).toHaveBeenCalledWith('Inbox')
    })

    expect(result.current.feedback?.msg).toBe(
      "Topic slug 'inbox' is used by a deleted topic — restore or permanently delete it first",
    )
  })

  it('does not submit a word twice while the save mutation is pending', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })

    vi.mocked(topicsApi.fetchTopics).mockResolvedValue([makeTopic(1, 'Inbox'), makeTopic(2, 'Verbs')])
    vi.mocked(wordsApi.quickAddWord).mockImplementation(() => new Promise<Word>(() => {}))

    const {result} = renderHook(() => useQuickAdd(vi.fn()), {wrapper: wrapper(queryClient)})

    await waitFor(() => {
      expect(result.current.topicsLoading).toBe(false)
    })

    act(() => {
      result.current.setTerm('run')
      result.current.setTranslation('correr')
      result.current.setTopicId(2)
    })

    await waitFor(() => {
      expect(result.current.term).toBe('run')
      expect(result.current.translation).toBe('correr')
    })

    act(() => {
      result.current.save()
    })

    await waitFor(() => {
      expect(result.current.savePending).toBe(true)
    })

    act(() => {
      result.current.save()
    })

    expect(wordsApi.quickAddWord).toHaveBeenCalledTimes(1)
  })

  it('does not create a topic twice while the create mutation is pending', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })

    vi.mocked(topicsApi.fetchTopics).mockResolvedValue([makeTopic(1, 'Inbox')])
    vi.mocked(topicsApi.createTopic).mockImplementation(() => new Promise<Topic>(() => {}))

    const {result} = renderHook(() => useQuickAdd(vi.fn()), {wrapper: wrapper(queryClient)})

    await waitFor(() => {
      expect(result.current.topicsLoading).toBe(false)
    })

    act(() => {
      result.current.setNewTopic('Astronomy')
    })

    await waitFor(() => {
      expect(result.current.newTopic).toBe('Astronomy')
    })

    act(() => {
      result.current.createTopic()
    })

    await waitFor(() => {
      expect(result.current.createTopicPending).toBe(true)
    })

    act(() => {
      result.current.createTopic()
    })

    expect(topicsApi.createTopic).toHaveBeenCalledTimes(1)
  })

  it('creates Inbox automatically and invalidates topics and stats when no Inbox exists', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    vi.mocked(topicsApi.fetchTopics).mockResolvedValue([makeTopic(2, 'Verbs')])
    vi.mocked(topicsApi.createTopic).mockResolvedValue(makeTopic(1, 'Inbox'))
    vi.mocked(wordsApi.quickAddWord).mockResolvedValue(makeWord(10, 'run'))

    const {result} = renderHook(() => useQuickAdd(vi.fn()), {wrapper: wrapper(queryClient)})

    await waitFor(() => {
      expect(result.current.topicsLoading).toBe(false)
    })

    act(() => {
      result.current.setTerm('run')
      result.current.setTranslation('correr')
    })

    act(() => {
      result.current.save()
    })

    await waitFor(() => {
      expect(topicsApi.createTopic).toHaveBeenCalledWith('Inbox')
    })

    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.topics})
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.stats})
  })

  it('matches AI-suggested topics case-insensitively, following the backend topic-name rule', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })

    vi.mocked(topicsApi.fetchTopics).mockResolvedValue([makeTopic(2, 'Phrasal Verbs', 'phrasal-verbs')])
    vi.spyOn(quickAddService, 'suggestTopic').mockResolvedValue('phrasal verbs')

    const {result} = renderHook(() => useQuickAdd(vi.fn()), {wrapper: wrapper(queryClient)})

    await waitFor(() => {
      expect(result.current.topicsLoading).toBe(false)
    })

    act(() => {
      result.current.setTerm('run into')
      result.current.setTranslation('наткнуться')
    })

    await act(async () => {
      await result.current.suggestOnly()
    })

    expect(result.current.topicId).toBe(2)
    expect(result.current.aiSuggested).toBe(true)
    expect(result.current.feedback).toBeNull()
  })

  it('reports duplicate quick-add failures as library-wide, matching the backend rule', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })

    vi.mocked(topicsApi.fetchTopics).mockResolvedValue([makeTopic(1, 'Inbox'), makeTopic(2, 'Verbs')])
    vi.mocked(wordsApi.quickAddWord).mockRejectedValue(new ApiError(409, "Word 'run' already exists in the database"))

    const {result} = renderHook(() => useQuickAdd(vi.fn()), {wrapper: wrapper(queryClient)})

    await waitFor(() => {
      expect(result.current.topicsLoading).toBe(false)
    })

    act(() => {
      result.current.setTerm('run')
      result.current.setTranslation('correr')
      result.current.setTopicId(2)
    })

    await waitFor(() => {
      expect(result.current.term).toBe('run')
      expect(result.current.translation).toBe('correr')
      expect(result.current.topicId).toBe(2)
    })

    act(() => {
      result.current.save()
    })

    await waitFor(() => {
      expect(result.current.feedback?.msg).toBe('"run" already exists in your library')
    })
  })
})
