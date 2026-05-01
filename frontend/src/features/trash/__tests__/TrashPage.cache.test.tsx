import {render, screen, fireEvent, waitFor} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {MemoryRouter} from 'react-router-dom'
import {describe, expect, it, vi, beforeEach} from 'vitest'
import {TrashPage} from '@/features/trash/routes/TrashPage'
import {queryKeys} from '@/app/queryKeys'
import type {Topic} from '@/features/topics/types/topicTypes'
import type {Word} from '@/features/words/types/wordTypes'
import {ApiError} from '@/shared/api/apiError'
import * as wordsApi from '@/features/words/api/wordsApi'
import * as topicsApi from '@/features/topics/api/topicsApi'
import * as trashApi from '@/features/trash/api/trashApi'
import * as publicConfig from '@/shared/config/usePublicConfig'

vi.mock('@/features/words/api/wordsApi')
vi.mock('@/features/topics/api/topicsApi')
vi.mock('@/features/trash/api/trashApi')
vi.mock('@/shared/config/usePublicConfig')

function makeWord(id: number, term: string): Word & {deleted_at: string} {
  return {
    id,
    topic_ids: [1],
    term,
    past_simple: null,
    past_participle: null,
    translations: term,
    translation_entries: undefined,
    part_of_speech: 'verb',
    knowledge_level: 2,
    countability: null,
    pattern: null,
    example: null,
    example_entries: undefined,
    example_count: 0,
    example_target_count: 3,
    example_status: 'missing',
    needs_example_enrichment: false,
    notes: null,
    is_active: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    deleted_at: '2024-01-10T00:00:00Z',
  }
}

function makeTopic(id: number, name: string): Topic & {deleted_at: string} {
  return {
    id,
    name,
    slug: name.toLowerCase(),
    description: null,
    is_active: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    deleted_at: '2024-01-10T00:00:00Z',
  }
}

function renderTrash(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/trash']}>
        <TrashPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('TrashPage cache invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(publicConfig.usePublicConfig).mockReturnValue({
      data: {trash_retention_days: 30},
    } as never)
  })

  it('invalidates the dependent caches after restoring a word', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const restoreWordMock = vi.mocked(wordsApi.restoreWord)

    vi.mocked(wordsApi.fetchTrashWords).mockResolvedValue([makeWord(1, 'run')])
    vi.mocked(topicsApi.fetchTrashTopics).mockResolvedValue([])
    vi.mocked(wordsApi.restoreWord).mockResolvedValue(makeWord(1, 'run'))

    renderTrash(queryClient)

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Restore'})).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', {name: 'Restore'}))

    await waitFor(() => {
      expect(restoreWordMock).toHaveBeenCalled()
      expect(restoreWordMock.mock.calls[0]?.[0]).toBe(1)
    })

    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.words})
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.trashWords})
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.topics})
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.topicSidebar})
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.stats})
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.smartReview})
  })

  it('shows backend restore-word errors inline so the user can follow the topic-restore guidance', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })

    vi.mocked(wordsApi.fetchTrashWords).mockResolvedValue([makeWord(1, 'run')])
    vi.mocked(topicsApi.fetchTrashTopics).mockResolvedValue([])
    vi.mocked(wordsApi.restoreWord).mockRejectedValueOnce(
      new ApiError(409, 'Cannot restore word: all its topics are deleted. Restore a topic first.'),
    )

    renderTrash(queryClient)

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Restore'})).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', {name: 'Restore'}))

    await waitFor(() => {
      expect(wordsApi.restoreWord).toHaveBeenCalled()
      expect(vi.mocked(wordsApi.restoreWord).mock.calls[0]?.[0]).toBe(1)
    })

    expect(
      screen.getByText('Cannot restore word: all its topics are deleted. Restore a topic first.'),
    ).toBeTruthy()
  })

  it('invalidates the dependent caches after restoring a topic', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    vi.mocked(wordsApi.fetchTrashWords).mockResolvedValue([])
    vi.mocked(topicsApi.fetchTrashTopics).mockResolvedValue([makeTopic(2, 'Alpha')])
    vi.mocked(topicsApi.restoreTopic).mockResolvedValue(makeTopic(2, 'Alpha'))

    renderTrash(queryClient)

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Restore'})).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', {name: 'Restore'}))
    fireEvent.click(screen.getByRole('button', {name: 'Restore topic + words'}))

    await waitFor(() => {
      expect(topicsApi.restoreTopic).toHaveBeenCalledWith(2, true)
    })

    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.topics})
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.words})
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.trashTopics})
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.trashWords})
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.topicSidebar})
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.stats})
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.smartReview})
  })

  it('keeps the restore topic modal open and shows backend errors so the fallback action stays available', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })

    vi.mocked(wordsApi.fetchTrashWords).mockResolvedValue([])
    vi.mocked(topicsApi.fetchTrashTopics).mockResolvedValue([makeTopic(2, 'Alpha')])
    vi.mocked(topicsApi.restoreTopic).mockRejectedValueOnce(
      new ApiError(409, "Word 'run' already exists in the database"),
    )

    renderTrash(queryClient)

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Restore'})).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', {name: 'Restore'}))
    fireEvent.click(screen.getByRole('button', {name: 'Restore topic + words'}))

    await waitFor(() => {
      expect(topicsApi.restoreTopic).toHaveBeenCalledWith(2, true)
    })

    expect(
      screen.getByText("Word 'run' already exists in the database"),
    ).toBeTruthy()
    expect(screen.getByRole('button', {name: 'Restore topic only'})).toBeTruthy()
  })

  it('invalidates dependent caches after purging trash', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    vi.mocked(wordsApi.fetchTrashWords).mockResolvedValue([makeWord(1, 'run')])
    vi.mocked(topicsApi.fetchTrashTopics).mockResolvedValue([makeTopic(2, 'Alpha')])
    vi.mocked(trashApi.purgeTrash).mockResolvedValue(undefined)

    renderTrash(queryClient)

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Empty Trash'})).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', {name: 'Empty Trash'}))
    fireEvent.click(screen.getAllByRole('button', {name: 'Empty Trash'})[1])

    await waitFor(() => {
      expect(trashApi.purgeTrash).toHaveBeenCalled()
    })

    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.topics})
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.words})
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.trashWords})
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.trashTopics})
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.topicSidebar})
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.stats})
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.smartReview})
  })
})
