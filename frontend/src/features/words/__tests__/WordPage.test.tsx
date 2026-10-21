import {act, render, screen, fireEvent, waitFor} from '@testing-library/react'
import {createMemoryRouter, RouterProvider} from 'react-router-dom'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {describe, it, expect, vi, beforeEach} from 'vitest'
import {WordPage} from '@/features/words/routes/WordPage'
import {queryKeys} from '@/app/queryKeys'
import {ApiError} from '@/shared/api/apiError'
import type {Topic} from '@/features/topics/types/topicTypes'
import type {Word, EnrichResult} from '@/features/words/types/wordTypes'
import * as wordsApi from '@/features/words/api/wordsApi'
import * as topicsApi from '@/features/topics/api/topicsApi'
import * as publicConfig from '@/shared/config/usePublicConfig'

vi.mock('@/features/words/api/wordsApi', () => ({
  fetchWord: vi.fn(),
  fetchWords: vi.fn(),
  fetchWordList: vi.fn(),
  updateWord: vi.fn(),
  deleteWord: vi.fn(),
  updateWordKnowledgeLevel: vi.fn(),
  quickAddWord: vi.fn(),
  restoreWord: vi.fn(),
  fetchTrashWords: vi.fn(),
  enrichWord: vi.fn(),
}))

vi.mock('@/features/topics/api/topicsApi', () => ({
  fetchTopics: vi.fn(),
  createTopic: vi.fn(),
  deleteTopic: vi.fn(),
  restoreTopic: vi.fn(),
  fetchTrashTopics: vi.fn(),
}))

vi.mock('@/shared/config/usePublicConfig', () => ({
  usePublicConfig: vi.fn(),
}))

function makeTopic(id: number, slug: string, name = slug): Topic {
  return {
    id,
    slug,
    name,
    description: null,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }
}

function makeWord(id: number, term: string, topicIds: number[] = [1]): Word {
  return {
    id,
    topic_ids: topicIds,
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
    translation_entries: [`${term}-translation`],
    part_of_speech: 'noun',
    knowledge_level: 3,
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

const word1 = makeWord(1, 'alpha')
const word2 = makeWord(2, 'beta')

function buildRouter(initialPath: string, state?: Record<string, unknown>) {
  return createMemoryRouter(
    [
      {path: '/words/:wordId', element: <WordPage />},
      {path: '/words/:wordId/edit', element: <WordPage />},
      {path: '/topics/:topicSlug', element: <div>topic page</div>},
      {path: '/', element: <div>vocabulary page</div>},
      {path: '/smart-review', element: <div>daily mix page</div>},
      {path: '/words', element: <div>all words page</div>},
    ],
    {initialEntries: [{pathname: initialPath, state}]},
  )
}

describe('WordPage — draft reset on word navigation', () => {
  beforeEach(() => {
    vi.mocked(publicConfig.usePublicConfig).mockReturnValue({
      data: {trash_retention_days: 30},
    } as never)
    vi.mocked(topicsApi.fetchTopics).mockResolvedValue([makeTopic(1, 'alpha-topic', 'Alpha Topic')])
    vi.mocked(wordsApi.fetchWords).mockResolvedValue([word1, word2])
    vi.mocked(wordsApi.updateWord).mockResolvedValue(word1)
    vi.mocked(wordsApi.deleteWord).mockResolvedValue(undefined)
  })

  it('keeps the filtered list sequence and return state when moving to the next word', async () => {
    vi.mocked(wordsApi.fetchWord).mockImplementation(async id => id === 1 ? word1 : word2)
    const state = {returnTo: {pathname: '/', search: '?level=1&page=2', scrollTop: 844}, wordList: {ids: [1, 2], offset: 50, total: 69}}
    const router = buildRouter('/words/1', state)
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}})
    render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>)
    await screen.findByRole('heading', {name: 'alpha'})
    expect(screen.getByText('51 / 69')).toBeTruthy()
    expect(screen.getByRole('button', {name: 'All words'})).toBeTruthy()
    fireEvent.click(screen.getByRole('button', {name: 'Next'}))
    await screen.findByRole('heading', {name: 'beta'})
    expect(screen.getByText('52 / 69')).toBeTruthy()
    expect(router.state.location.state).toEqual(state)
    fireEvent.click(screen.getByRole('button', {name: 'Back'}))
    await screen.findByText('vocabulary page')
    expect(router.state.location.search).toBe('?level=1&page=2')
    expect(router.state.location.state).toEqual({wordListScrollTop: 844})
  })

  it('shows a retryable load error for a network failure instead of claiming the word is missing', async () => {
    vi.mocked(wordsApi.fetchWord).mockReset().mockRejectedValueOnce(new ApiError(503, 'Unavailable')).mockResolvedValue(word1)
    const router = buildRouter('/words/1')
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}})
    render(<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>)
    expect((await screen.findByRole('alert')).textContent).toContain('Failed to load word')
    expect(screen.queryByText('Word not found.')).toBeNull()
    fireEvent.click(screen.getByRole('button', {name: 'Retry'}))
    await screen.findByRole('heading', {name: 'alpha'})
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('keeps an actual HTTP 404 distinct from a network failure', async () => {
    vi.mocked(wordsApi.fetchWord).mockReset().mockRejectedValue(new ApiError(404, 'Not found'))
    const router = buildRouter('/words/1')
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}})
    render(<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>)
    await screen.findByText('Word not found.')
    expect(screen.queryByRole('button', {name: 'Retry'})).toBeNull()
  })

  it.each(['/', '/smart-review', '/topics/alpha-topic', '/words'])('returns to the exact filtered list at %s', async pathname => {
    vi.mocked(wordsApi.fetchWord).mockResolvedValue(word1)
    const search = '?search=alpha&level=2&cefr=A1&sort=term-desc&page=3&pageSize=50'
    const router = buildRouter('/words/1', {fromTopicSlug: 'alpha-topic', returnTo: {pathname, search, scrollTop: 420}})
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}})
    render(<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>)
    fireEvent.click(await screen.findByRole('button', {name: 'Back'}))
    await waitFor(() => expect(router.state.location.pathname).toBe(pathname))
    expect(router.state.location.search).toBe(search)
    expect(router.state.location.state?.wordListScrollTop).toBe(420)
  })

  it('keeps the original list after editing and saving', async () => {
    vi.mocked(wordsApi.fetchWord).mockResolvedValue(word1)
    const returnTo = {pathname: '/smart-review', search: '?level=2&page=2', scrollTop: 300}
    const router = buildRouter('/words/1', {returnTo})
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}})
    render(<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>)
    fireEvent.click(await screen.findByRole('button', {name: 'Edit'}))
    fireEvent.click(await screen.findByRole('button', {name: 'Save'}))
    await waitFor(() => expect(router.state.location.pathname).toBe('/words/1'))
    expect(router.state.location.state.returnTo).toEqual(returnTo)
    fireEvent.click(await screen.findByRole('button', {name: 'Back'}))
    await waitFor(() => expect(router.state.location.pathname).toBe('/smart-review'))
    expect(router.state.location.search).toBe('?level=2&page=2')
  })

  it('locks the edit form during save and preserves the draft for retry after failure', async () => {
    vi.mocked(wordsApi.fetchWord).mockResolvedValue(word1)
    let rejectSave!: (reason: Error) => void
    const pending = new Promise<Word>((_resolve, reject) => {rejectSave = reject})
    vi.mocked(wordsApi.updateWord).mockClear().mockReturnValueOnce(pending).mockResolvedValue(word1)
    const router = buildRouter('/words/1/edit')
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}})
    render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>)
    const term = await screen.findByLabelText('Term')
    fireEvent.change(term, {target: {value: 'revised alpha'}})
    fireEvent.click(screen.getByRole('button', {name: 'Save'}))
    await screen.findByRole('button', {name: 'Saving…'})
    expect(term.matches(':disabled')).toBe(true)
    expect(screen.getByLabelText('Translations (one per line)').matches(':disabled')).toBe(true)
    expect(screen.getByRole('button', {name: 'Cancel'}).matches(':disabled')).toBe(true)
    expect(screen.getByRole('button', {name: 'Delete'}).matches(':disabled')).toBe(true)
    expect(screen.getByRole('button', {name: 'Back'}).matches(':disabled')).toBe(true)
    await act(async () => {rejectSave(new Error('Unavailable')); await pending.catch(() => {})})
    await screen.findByRole('alert')
    expect((term as HTMLInputElement).value).toBe('revised alpha')
    expect(term.matches(':disabled')).toBe(false)
    fireEvent.click(screen.getByRole('button', {name: 'Save'}))
    await waitFor(() => expect(router.state.location.pathname).toBe('/words/1'))
    expect(wordsApi.updateWord).toHaveBeenCalledTimes(2)
    expect(wordsApi.updateWord).toHaveBeenLastCalledWith(1, expect.objectContaining({term: 'revised alpha'}))
  })

  it('resets edit draft when navigating from word 1 edit to word 2 edit', async () => {
    vi.mocked(wordsApi.fetchWord).mockImplementation((id) =>
      Promise.resolve(id === 1 ? word1 : word2),
    )

    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })
    const router = buildRouter('/words/1/edit')

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByDisplayValue('alpha')).toBeTruthy()
    })

    expect(screen.getByLabelText('Term')).toBe(screen.getByDisplayValue('alpha'))
    expect(screen.getByLabelText('Translations (one per line)')).toBeTruthy()

    void router.navigate('/words/2/edit')

    await waitFor(() => {
      expect(screen.getByDisplayValue('beta')).toBeTruthy()
    })

    expect(screen.queryByDisplayValue('alpha')).toBeNull()
  })

  it('does not attach enrichment for the old term to a changed edit draft', async () => {
    vi.mocked(wordsApi.fetchWord).mockResolvedValue(word1)
    let resolveEnrichment!: (value: EnrichResult) => void
    const pending = new Promise<EnrichResult>(resolve => { resolveEnrichment = resolve })
    vi.mocked(wordsApi.enrichWord).mockReturnValueOnce(pending)
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}})
    const router = buildRouter('/words/1/edit')
    render(<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>)
    await screen.findByLabelText('Term')
    fireEvent.click(screen.getByRole('button', {name: '✨ Enrich with AI'}))
    fireEvent.change(screen.getByLabelText('Term'), {target: {value: 'bravo'}})
    await act(async () => {
      resolveEnrichment({definition: 'alpha definition'} as EnrichResult)
      await pending
    })
    expect((screen.getByLabelText('Definition') as HTMLTextAreaElement).value).toBe('')
  })

  it('waits for enrichment before allowing the edited word to be saved', async () => {
    vi.mocked(wordsApi.fetchWord).mockResolvedValue(word1)
    vi.mocked(wordsApi.updateWord).mockClear()
    let resolveEnrichment!: (value: EnrichResult) => void
    const pending = new Promise<EnrichResult>(resolve => {resolveEnrichment = resolve})
    vi.mocked(wordsApi.enrichWord).mockReturnValueOnce(pending)
    const router = buildRouter('/words/1/edit')
    const client = new QueryClient({defaultOptions: {queries: {retry: false}}})
    render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>)
    await screen.findByLabelText('Term')
    fireEvent.click(screen.getByRole('button', {name: '✨ Enrich with AI'}))
    expect(screen.getByRole('button', {name: 'Save'}).matches(':disabled')).toBe(true)
    fireEvent.click(screen.getByRole('button', {name: 'Save'}))
    expect(wordsApi.updateWord).not.toHaveBeenCalled()
    await act(async () => {
      resolveEnrichment({definition: 'Enriched definition', translation_entries: [], example_entries: [], synonym_entries: [], antonym_entries: [], collocation_entries: []} as unknown as EnrichResult)
      await pending
    })
    expect(screen.getByRole('button', {name: 'Save'}).matches(':disabled')).toBe(false)
    fireEvent.click(screen.getByRole('button', {name: 'Save'}))
    await waitFor(() => expect(wordsApi.updateWord).toHaveBeenCalledWith(1, expect.objectContaining({definition: 'Enriched definition'})))
  })
})

describe('WordPage — cache invalidation after save', () => {
  beforeEach(() => {
    vi.mocked(topicsApi.fetchTopics).mockResolvedValue([makeTopic(1, 'alpha-topic', 'Alpha Topic')])
    vi.mocked(wordsApi.fetchWord).mockResolvedValue(word1)
    vi.mocked(wordsApi.fetchWords).mockResolvedValue([word1])
    vi.mocked(wordsApi.updateWord).mockResolvedValue(word1)
  })

  it('invalidates words and stats after save', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const router = buildRouter('/words/1/edit')

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByDisplayValue('alpha')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(wordsApi.updateWord).toHaveBeenCalled()
    })

    await waitFor(() => {
      const keys = invalidateSpy.mock.calls.map((c) => (c[0] as {queryKey: unknown}).queryKey)
      expect(keys).toContainEqual(queryKeys.words)
      expect(keys).toContainEqual(queryKeys.stats)
    })
  })
})

describe('WordPage — cache invalidation after delete', () => {
  beforeEach(() => {
    vi.mocked(topicsApi.fetchTopics).mockResolvedValue([makeTopic(1, 'alpha-topic', 'Alpha Topic')])
    vi.mocked(wordsApi.fetchWord).mockResolvedValue(word1)
    vi.mocked(wordsApi.fetchWords).mockResolvedValue([word1])
    vi.mocked(wordsApi.deleteWord).mockResolvedValue(undefined)
  })

  it('invalidates words, stats, and trashWords after delete', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const router = buildRouter('/words/1/edit')

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('Delete'))

    await waitFor(() => {
      expect(screen.getByText('Move to Trash')).toBeTruthy()
    })

    expect(
      screen.getByText('"alpha" will be moved to Trash and permanently deleted after 30 days.'),
    ).toBeTruthy()

    const confirmBtn = screen.getAllByText('Move to Trash').find(
      (el) => el.tagName === 'BUTTON',
    )
    fireEvent.click(confirmBtn!)

    await waitFor(() => {
      expect(wordsApi.deleteWord).toHaveBeenCalled()
    })

    await waitFor(() => {
      const keys = invalidateSpy.mock.calls.map((c) => (c[0] as {queryKey: unknown}).queryKey)
      expect(keys).toContainEqual(queryKeys.words)
      expect(keys).toContainEqual(queryKeys.stats)
      expect(keys).toContainEqual(queryKeys.trashWords)
    })
  })

  it('uses the backend trash retention setting in the delete confirmation copy', async () => {
    vi.mocked(publicConfig.usePublicConfig).mockReturnValue({
      data: {trash_retention_days: 45},
    } as never)

    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })
    const router = buildRouter('/words/1/edit')

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('Delete'))

    await waitFor(() => {
      expect(
        screen.getByText('"alpha" will be moved to Trash and permanently deleted after 45 days.'),
      ).toBeTruthy()
    })
  })

  it('shows a failed deletion and keeps the word on the edit screen', async () => {
    vi.mocked(wordsApi.deleteWord).mockRejectedValueOnce(new Error('Network down'))
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}})
    const router = buildRouter('/words/1/edit')
    render(<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>)
    fireEvent.click(await screen.findByRole('button', {name: 'Delete'}))
    fireEvent.click(screen.getByRole('button', {name: 'Move to Trash'}))
    expect((await screen.findByRole('alert')).textContent).toContain('Failed to delete')
    expect(router.state.location.pathname).toBe('/words/1/edit')
    expect(screen.getByDisplayValue('alpha')).toBeTruthy()
  })

  it('keeps deletion confirmation disabled until the request finishes', async () => {
    let resolveDelete!: () => void
    vi.mocked(wordsApi.deleteWord).mockImplementationOnce(() => new Promise(resolve => {
      resolveDelete = resolve
    }))
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}})
    const router = buildRouter('/words/1/edit')
    render(<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>)
    fireEvent.click(await screen.findByRole('button', {name: 'Delete'}))
    fireEvent.click(screen.getByRole('button', {name: 'Move to Trash'}))
    await waitFor(() => {
      expect((screen.getByRole('button', {name: 'Move to Trash'}) as HTMLButtonElement).disabled).toBe(true)
    })
    await act(async () => { resolveDelete() })
  })
})

describe('WordPage — topic editing', () => {
  beforeEach(() => {
    vi.mocked(topicsApi.fetchTopics).mockResolvedValue([
      makeTopic(1, 'alpha-topic', 'Alpha Topic'),
      makeTopic(2, 'beta-topic', 'Beta Topic'),
    ])
    vi.mocked(wordsApi.fetchWord).mockResolvedValue(word1)
    vi.mocked(wordsApi.fetchWords).mockResolvedValue([word1])
    vi.mocked(wordsApi.updateWord).mockResolvedValue(word1)
  })

  it('can add an additional topic before saving', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })
    const router = buildRouter('/words/1/edit')

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByDisplayValue('alpha')).toBeTruthy()
    })

    fireEvent.click(screen.getByLabelText('Beta Topic'))
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(wordsApi.updateWord).toHaveBeenCalledWith(
        1,
        expect.objectContaining({topic_ids: [1, 2]}),
      )
    })
  })
})
