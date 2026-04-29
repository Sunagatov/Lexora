import {render, screen, fireEvent, waitFor} from '@testing-library/react'
import {MemoryRouter, Route, Routes} from 'react-router-dom'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {describe, it, expect, vi, beforeEach} from 'vitest'
import {useWordPageState} from '../useWordPageState'
import {queryKeys} from '../../../app/queryKeys'
import type {Topic, Word} from '../../../shared/types'
import {ApiError} from '../../../shared/apiError'
import * as wordsApi from '../api'
import * as topicsApi from '../../topics/api'

vi.mock('../api', () => ({
  fetchWord: vi.fn(),
  fetchWords: vi.fn(),
  updateWord: vi.fn(),
  deleteWord: vi.fn(),
  updateWordKnowledgeLevel: vi.fn(),
  quickAddWord: vi.fn(),
  restoreWord: vi.fn(),
  fetchTrashWords: vi.fn(),
}))

vi.mock('../../topics/api', () => ({
  fetchTopics: vi.fn(),
  createTopic: vi.fn(),
  deleteTopic: vi.fn(),
  restoreTopic: vi.fn(),
  fetchTrashTopics: vi.fn(),
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

function makeWord(overrides: Partial<Word> = {}): Word {
  return {
    id: 10,
    topic_ids: [1],
    term: 'carry',
    past_simple: null,
    past_participle: null,
    translations: 'нести',
    part_of_speech: 'verb',
    knowledge_level: 2,
    countability: null,
    pattern: null,
    example: null,
    notes: null,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

function Harness() {
  const s = useWordPageState()

  if (s.isInvalidWordId) return <div>invalid</div>
  if (s.isLoading) return <div>loading</div>

  return (
    <div>
      <div data-testid="draft-state">{s.draft ? 'ready' : 'empty'}</div>
      <div data-testid="save-error">{s.saveError ?? ''}</div>
      <button type="button" onClick={s.save}>save</button>
      <button type="button" onClick={s.handleDelete}>delete</button>
    </div>
  )
}

function renderHarness(queryClient: QueryClient, entry: {pathname: string; state?: unknown}) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/words/:wordId" element={<Harness />} />
          <Route path="/words/:wordId/edit" element={<Harness />} />
          <Route path="/topics/:topicSlug" element={<div>topic page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('useWordPageState cache invalidation', () => {
  beforeEach(() => {
    vi.mocked(topicsApi.fetchTopics).mockResolvedValue([
      makeTopic(1, 'alpha', 'Alpha'),
      makeTopic(2, 'beta', 'Beta'),
    ])

    vi.mocked(wordsApi.fetchWord).mockResolvedValue(makeWord())
    vi.mocked(wordsApi.fetchWords).mockResolvedValue([makeWord()])
    vi.mocked(wordsApi.updateWord).mockResolvedValue(makeWord({topic_ids: [2]}))
    vi.mocked(wordsApi.deleteWord).mockResolvedValue(undefined)
  })

  it('invalidates the words query family after save', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {retry: false},
        mutations: {retry: false},
      },
    })

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderHarness(queryClient, {
      pathname: '/words/10/edit',
      state: {fromTopicSlug: 'alpha'},
    })

    await waitFor(() => {
      expect(screen.getByTestId('draft-state').textContent).toBe('ready')
    })

    fireEvent.click(screen.getByText('save'))

    await waitFor(() => {
      expect(wordsApi.updateWord).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.words})
    })
  })

  it('invalidates the words query family after delete', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {retry: false},
        mutations: {retry: false},
      },
    })

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderHarness(queryClient, {
      pathname: '/words/10',
      state: {fromTopicSlug: 'alpha'},
    })

    await waitFor(() => {
      expect(screen.getByText('delete')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('delete'))

    await waitFor(() => {
      expect(wordsApi.deleteWord).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.words})
    })
  })

  it('reports duplicate save failures as library-wide, matching the backend rule', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {retry: false},
        mutations: {retry: false},
      },
    })

    vi.mocked(wordsApi.updateWord).mockRejectedValueOnce(
      new ApiError(409, "Word 'carry' already exists in the database"),
    )

    renderHarness(queryClient, {
      pathname: '/words/10/edit',
      state: {fromTopicSlug: 'alpha'},
    })

    await waitFor(() => {
      expect(screen.getByTestId('draft-state').textContent).toBe('ready')
    })

    fireEvent.click(screen.getByText('save'))

    await waitFor(() => {
      expect(wordsApi.updateWord).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(screen.getByTestId('save-error').textContent).toBe('A word with this term already exists in your library.')
    })
  })
})
