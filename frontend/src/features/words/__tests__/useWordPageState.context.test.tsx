import {render, screen, waitFor} from '@testing-library/react'
import {MemoryRouter, Route, Routes} from 'react-router-dom'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {describe, it, expect, vi, beforeEach} from 'vitest'
import {useWordPageState} from '@/features/words/hooks/useWordPageState'
import type {Topic} from '@/features/topics/types/topicTypes'
import type {Word} from '@/features/words/types/wordTypes'
import * as wordsApi from '@/features/words/api/wordsApi'
import * as topicsApi from '@/features/topics/api/topicsApi'

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

function makeTopic(id: number, slug: string, name = slug, parent_topic_id: number | null = null): Topic {
  return {
    id,
    slug,
    name,
    description: null,
    parent_topic_id,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }
}

function makeWord(overrides: Partial<Word> = {}): Word {
  return {
    id: 10,
    topic_ids: [2],
    term: 'migrate',
    past_simple: null,
    past_participle: null,
    translations: 'перемещать',
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

function Probe() {
  const s = useWordPageState()

  if (s.isInvalidWordId) return <div>invalid</div>
  if (s.isLoading) return <div>loading</div>

  return (
    <div>
      <div data-testid="topic-slug">{s.topic?.slug ?? 'none'}</div>
      <div data-testid="prev-word">{s.prevWord?.term ?? 'none'}</div>
      <div data-testid="next-word">{s.nextWord?.term ?? 'none'}</div>
    </div>
  )
}

function renderProbe() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {retry: false},
      mutations: {retry: false},
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/words/10',
            state: {fromTopicSlug: 'alpha'},
          },
        ]}
      >
        <Routes>
          <Route path="/words/:wordId" element={<Probe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('useWordPageState topic context fallback', () => {
  beforeEach(() => {
    vi.mocked(topicsApi.fetchTopics).mockResolvedValue([
      makeTopic(1, 'alpha', 'Alpha'),
      makeTopic(2, 'beta', 'Beta'),
    ])
    vi.mocked(wordsApi.fetchWord).mockResolvedValue(makeWord({topic_ids: [2]}))
    vi.mocked(wordsApi.fetchWords).mockResolvedValue([makeWord({topic_ids: [2]})])
  })

  it('falls back to a valid current topic when fromTopicSlug is stale', async () => {
    renderProbe()

    await waitFor(() => {
      expect(screen.getByTestId('topic-slug').textContent).toBe('beta')
    })
  })

  it('preserves a parent topic slug when the word is shown via that topic subtree', async () => {
    vi.mocked(topicsApi.fetchTopics).mockResolvedValue([
      makeTopic(1, 'parent', 'Parent'),
      makeTopic(2, 'child', 'Child', 1),
    ])
    vi.mocked(wordsApi.fetchWord).mockResolvedValue(makeWord({topic_ids: [2]}))
    vi.mocked(wordsApi.fetchWords).mockResolvedValue([makeWord({topic_ids: [2]})])

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {retry: false},
        mutations: {retry: false},
      },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          initialEntries={[
            {
              pathname: '/words/10',
              state: {fromTopicSlug: 'parent'},
            },
          ]}
        >
          <Routes>
            <Route path="/words/:wordId" element={<Probe />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('topic-slug').textContent).toBe('parent')
    })
  })

  it('includes descendant-topic words in prev/next navigation when viewing a parent topic subtree', async () => {
    vi.mocked(topicsApi.fetchTopics).mockResolvedValue([
      makeTopic(1, 'parent', 'Parent'),
      makeTopic(2, 'child', 'Child', 1),
    ])
    vi.mocked(wordsApi.fetchWord).mockResolvedValue(makeWord({id: 10, term: 'migrate', topic_ids: [2]}))
    vi.mocked(wordsApi.fetchWords).mockResolvedValue([
      makeWord({id: 5, term: 'arrive', topic_ids: [2]}),
      makeWord({id: 10, term: 'migrate', topic_ids: [2]}),
      makeWord({id: 15, term: 'zoom', topic_ids: [2]}),
    ])

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {retry: false},
        mutations: {retry: false},
      },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          initialEntries={[
            {
              pathname: '/words/10',
              state: {fromTopicSlug: 'parent'},
            },
          ]}
        >
          <Routes>
            <Route path="/words/:wordId" element={<Probe />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('prev-word').textContent).toBe('arrive')
      expect(screen.getByTestId('next-word').textContent).toBe('zoom')
    })
  })
})
