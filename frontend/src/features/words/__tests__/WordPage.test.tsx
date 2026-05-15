import {render, screen, fireEvent, waitFor} from '@testing-library/react'
import {createMemoryRouter, RouterProvider} from 'react-router-dom'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {describe, it, expect, vi, beforeEach} from 'vitest'
import {WordPage} from '@/features/words/routes/WordPage'
import {queryKeys} from '@/app/queryKeys'
import type {Topic} from '@/features/topics/types/topicTypes'
import type {Word} from '@/features/words/types/wordTypes'
import * as wordsApi from '@/features/words/api/wordsApi'
import * as topicsApi from '@/features/topics/api/topicsApi'
import * as publicConfig from '@/shared/config/usePublicConfig'

vi.mock('@/features/words/api/wordsApi', () => ({
  fetchWord: vi.fn(),
  fetchWords: vi.fn(),
  updateWord: vi.fn(),
  deleteWord: vi.fn(),
  updateWordKnowledgeLevel: vi.fn(),
  quickAddWord: vi.fn(),
  restoreWord: vi.fn(),
  fetchTrashWords: vi.fn(),
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
    knowledge_level: 2,
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

function buildRouter(initialPath: string) {
  return createMemoryRouter(
    [
      {path: '/words/:wordId', element: <WordPage />},
      {path: '/words/:wordId/edit', element: <WordPage />},
      {path: '/topics/:topicSlug', element: <div>topic page</div>},
    ],
    {initialEntries: [initialPath]},
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

    void router.navigate('/words/2/edit')

    await waitFor(() => {
      expect(screen.getByDisplayValue('beta')).toBeTruthy()
    })

    expect(screen.queryByDisplayValue('alpha')).toBeNull()
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
