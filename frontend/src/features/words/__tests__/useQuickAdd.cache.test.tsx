import {act, renderHook, waitFor} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {describe, expect, it, vi, beforeEach} from 'vitest'
import type {ReactNode} from 'react'
import {useQuickAdd} from '@/features/words/hooks/useQuickAdd'
import {queryKeys} from '@/app/queryKeys'
import type {Topic} from '@/features/topics/types/topicTypes'
import type {Word, EnrichResult} from '@/features/words/types/wordTypes'
import {ApiError} from '@/shared/api/apiError'
import * as topicsApi from '@/features/topics/api/topicsApi'
import * as wordsApi from '@/features/words/api/wordsApi'

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
    language: 'en',
    definition: null,
    pronunciation_ipa: null,
    pronunciation_audio_url: null,
    image_url: null,
    cefr_level: null,
    register: null,
    frequency_rank: null,
    verb_form: null,
    translation_entries: [term],
    part_of_speech: 'verb',
    knowledge_level: 1,
    countability: null,
    pattern: null,
    example_entries: [],
    example_count: 0,
    example_target_count: 3,
    example_status: 'missing',
    needs_example_enrichment: false,
    synonym_entries: [],
    antonym_entries: [],
    collocation_entries: [],
    confusable_entries: [],
    notes: null,
    is_active: true,
    deleted_at: null,
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

  it('clears an AI-filled translation on term changes while preserving manual translations', async () => {
    vi.mocked(topicsApi.fetchTopics).mockResolvedValue([makeTopic(1, 'Inbox')])
    vi.mocked(wordsApi.enrichWord).mockResolvedValue({...makeWord(10, 'cat'), translation_entries: ['кот']})
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}})
    const {result} = renderHook(() => useQuickAdd(), {wrapper: wrapper(client)})
    act(() => result.current.setTerm('cat'))
    await act(async () => { await result.current.enrich() })
    expect(result.current.translation).toBe('кот')
    act(() => result.current.setTerm('dog'))
    expect(result.current.translation).toBe('')
    expect(result.current.canSave).toBe(false)
    act(() => result.current.setTranslation('собака'))
    act(() => result.current.setTerm('puppy'))
    expect(result.current.translation).toBe('собака')
  })

  it('waits for a requested topic before allowing any save, including Enter', async () => {
    vi.mocked(topicsApi.fetchTopics).mockResolvedValue([makeTopic(1, 'Inbox')])
    let finish!: (topic: Topic) => void
    vi.mocked(topicsApi.createTopic).mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    vi.mocked(wordsApi.quickAddWord).mockResolvedValue(makeWord(10, 'cat'))
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}})
    const {result} = renderHook(() => useQuickAdd(), {wrapper: wrapper(client)})
    await waitFor(() => expect(result.current.topicId).toBe(1))
    act(() => { result.current.setTerm('cat'); result.current.setTranslation('кот'); result.current.setAddingTopic(true); result.current.setNewTopic('Animals') })
    expect(result.current.canSave).toBe(false)
    act(() => result.current.createTopic())
    await act(async () => { await result.current.save() })
    expect(wordsApi.quickAddWord).not.toHaveBeenCalled()
    await act(async () => { finish(makeTopic(2, 'Animals')) })
    await waitFor(() => expect(result.current.canSave).toBe(true))
    await act(async () => { await result.current.save() })
    await waitFor(() => expect(wordsApi.quickAddWord).toHaveBeenCalledWith(expect.objectContaining({topic_ids: [2]})))
  })

  it('ignores enrichment that arrives after the user changes the term', async () => {
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}})
    vi.mocked(topicsApi.fetchTopics).mockResolvedValue([makeTopic(1, 'Inbox')])
    let resolveEnrichment!: (value: EnrichResult) => void
    vi.mocked(wordsApi.enrichWord).mockImplementationOnce(() => new Promise(resolve => {
      resolveEnrichment = resolve
    }))
    const {result} = renderHook(() => useQuickAdd(), {wrapper: wrapper(queryClient)})
    act(() => { result.current.setTerm('alpha') })
    let pending!: Promise<void>
    act(() => { pending = result.current.enrich() })
    act(() => { result.current.setTerm('bravo') })
    await act(async () => {
      resolveEnrichment({translation_entries: ['alpha translation'], definition: 'alpha definition'} as EnrichResult)
      await pending
    })
    expect(result.current.term).toBe('bravo')
    expect(result.current.translation).toBe('')
    expect(result.current.enrichResult).toBeNull()
  })

  it('keeps enriched details when the user corrects the translation', async () => {
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}})
    vi.mocked(topicsApi.fetchTopics).mockResolvedValue([makeTopic(1, 'Inbox')])
    const enriched: EnrichResult = {...makeWord(10, 'run'), definition: 'Move quickly on foot.', example_entries: ['I run every day.']}
    vi.mocked(wordsApi.enrichWord).mockResolvedValue(enriched)
    vi.mocked(wordsApi.quickAddWord).mockResolvedValue(makeWord(10, 'run'))
    const {result} = renderHook(() => useQuickAdd(), {wrapper: wrapper(queryClient)})
    await waitFor(() => expect(result.current.topicId).toBe(1))
    act(() => result.current.setTerm('run'))
    await act(async () => { await result.current.enrich() })
    act(() => result.current.setTranslation('бежать'))
    await act(async () => { await result.current.save() })
    await waitFor(() => expect(wordsApi.quickAddWord).toHaveBeenCalledWith(expect.objectContaining({
      term: 'run', definition: enriched.definition, example_entries: enriched.example_entries,
      translation_entries: ['бежать', 'run'],
    })))
  })

  it('ignores enrichment that finishes after the word was saved manually', async () => {
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}})
    vi.mocked(topicsApi.fetchTopics).mockResolvedValue([makeTopic(1, 'Inbox')])
    let resolveEnrich!: (result: EnrichResult) => void
    vi.mocked(wordsApi.enrichWord).mockImplementationOnce(() => new Promise(resolve => { resolveEnrich = resolve }))
    vi.mocked(wordsApi.quickAddWord).mockResolvedValue(makeWord(10, 'run'))
    const {result} = renderHook(() => useQuickAdd(), {wrapper: wrapper(queryClient)})
    await waitFor(() => expect(result.current.topicId).toBe(1))
    act(() => { result.current.setTerm('run'); result.current.setTranslation('бежать') })
    let enrichment!: Promise<void>
    act(() => { enrichment = result.current.enrich() })
    await act(async () => { await result.current.save() })
    await waitFor(() => expect(result.current.feedback?.ok).toBe(true))
    await act(async () => { resolveEnrich({...makeWord(10, 'run'), translation_entries: ['бежать']}); await enrichment })
    expect(result.current.term).toBe('')
    expect(result.current.translation).toBe('')
    expect(result.current.enrichResult).toBeNull()
    expect(result.current.enriching).toBe(false)
  })

  it('locks saving during automatic Inbox creation and submits the original draft once', async () => {
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}})
    vi.mocked(topicsApi.fetchTopics).mockResolvedValue([makeTopic(2, 'Verbs')])
    let resolveInbox!: (topic: Topic) => void
    vi.mocked(topicsApi.createTopic).mockImplementationOnce(() => new Promise(resolve => { resolveInbox = resolve }))
    vi.mocked(wordsApi.quickAddWord).mockResolvedValue(makeWord(10, 'run'))
    const {result} = renderHook(() => useQuickAdd(), {wrapper: wrapper(queryClient)})
    await waitFor(() => expect(result.current.topicsLoading).toBe(false))
    act(() => { result.current.setTerm('run'); result.current.setTranslation('бежать') })
    act(() => { void result.current.save() })
    await waitFor(() => expect(topicsApi.createTopic).toHaveBeenCalledWith('Inbox'))
    expect(result.current.savePending).toBe(true)
    expect(result.current.canSave).toBe(false)
    act(() => { void result.current.save(); result.current.setTerm('walk') })
    await act(async () => { resolveInbox(makeTopic(1, 'Inbox')) })
    await waitFor(() => expect(wordsApi.quickAddWord).toHaveBeenCalledWith(expect.objectContaining({term: 'run', topic_ids: [1]})))
    expect(topicsApi.createTopic).toHaveBeenCalledTimes(1)
    expect(wordsApi.quickAddWord).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(result.current.feedback?.msg).toBe('"run" saved!'))
  })

  it('keeps the draft and permits retry when automatic Inbox creation fails', async () => {
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}})
    vi.mocked(topicsApi.fetchTopics).mockResolvedValue([])
    vi.mocked(topicsApi.createTopic).mockRejectedValueOnce(new Error('Network down')).mockResolvedValueOnce(makeTopic(1, 'Inbox'))
    vi.mocked(wordsApi.quickAddWord).mockResolvedValue(makeWord(10, 'run'))
    const {result} = renderHook(() => useQuickAdd(), {wrapper: wrapper(queryClient)})
    await waitFor(() => expect(result.current.topicsLoading).toBe(false))
    act(() => { result.current.setTerm('run'); result.current.setTranslation('бежать') })
    await act(async () => { await result.current.save() })
    await waitFor(() => expect(result.current.feedback?.msg).toBe('Could not create Inbox topic. Please select a topic manually.'))
    expect(result.current.term).toBe('run')
    expect(result.current.translation).toBe('бежать')
    expect(result.current.canSave).toBe(true)
    expect(wordsApi.quickAddWord).not.toHaveBeenCalled()
    await act(async () => { await result.current.save() })
    await waitFor(() => expect(result.current.feedback?.ok).toBe(true))
    expect(wordsApi.quickAddWord).toHaveBeenCalledTimes(1)
  })

  it('invalidates words, stats, and smart review after saving a word', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    vi.mocked(topicsApi.fetchTopics).mockResolvedValue([makeTopic(1, 'Inbox'), makeTopic(2, 'Verbs')])
    vi.mocked(wordsApi.quickAddWord).mockResolvedValue(makeWord(10, 'run'))

    const {result} = renderHook(() => useQuickAdd(), {wrapper: wrapper(queryClient)})

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
      expect(wordsApi.quickAddWord).toHaveBeenCalledWith(
        expect.objectContaining({term: 'run', translation_entries: ['correr'], topic_ids: [2], knowledge_level: 1}),
      )
    })

    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.words})
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.stats})
  })

  it('invalidates topics and stats after creating a topic', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    vi.mocked(topicsApi.fetchTopics).mockResolvedValue([makeTopic(1, 'Inbox')])
    vi.mocked(topicsApi.createTopic).mockResolvedValue(makeTopic(2, 'Astronomy', 'astronomy'))

    const {result} = renderHook(() => useQuickAdd(), {wrapper: wrapper(queryClient)})

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

    const {result} = renderHook(() => useQuickAdd(), {wrapper: wrapper(queryClient)})

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

    const {result} = renderHook(() => useQuickAdd(), {wrapper: wrapper(queryClient)})

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

    const {result} = renderHook(() => useQuickAdd(), {wrapper: wrapper(queryClient)})

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

    const {result} = renderHook(() => useQuickAdd(), {wrapper: wrapper(queryClient)})

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

  it('reports duplicate quick-add failures as library-wide, matching the backend rule', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })

    vi.mocked(topicsApi.fetchTopics).mockResolvedValue([makeTopic(1, 'Inbox'), makeTopic(2, 'Verbs')])
    vi.mocked(wordsApi.quickAddWord).mockRejectedValue(new ApiError(409, "Word 'run' already exists in the database"))

    const {result} = renderHook(() => useQuickAdd(), {wrapper: wrapper(queryClient)})

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
