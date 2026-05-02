import {render, screen, fireEvent, waitFor} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {MemoryRouter, Route, Routes} from 'react-router-dom'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {AppLayout} from '@/app/layout/AppLayout'
import {StudyPage} from '@/features/study/routes/StudyPage'

vi.mock('@/features/study/hooks/useStudyState', () => ({
  useStudyState: () => ({
    isSmartReview: false,
    topics: [],
    words: [],
    topicWords: [],
    selectedTopic: null,
    selectedTopicId: null,
    topicCounts: new Map(),
    topicProgress: new Map(),
    topicSearch: '',
    setTopicSearch: vi.fn(),
    selectTopic: vi.fn(),
    selectSmartReview: vi.fn(),
    wordSearch: '',
    setWordSearch: vi.fn(),
    levelFilter: 'all',
    setLevelFilter: vi.fn(),
    sortBy: 'term-asc',
    setSortBy: vi.fn(),
    levelSummary: {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, unset: 0},
    filteredWords: [],
    pageWords: [],
    page: 1,
    totalPages: 1,
    setPage: vi.fn(),
    pageSize: 20,
    setPageSize: vi.fn(),
    pageStart: 0,
    pageEnd: 0,
    resetFilters: vi.fn(),
    overallWordCount: 0,
    topicWordCount: 0,
    filteredWordCount: 0,
    updateLevel: vi.fn(),
    pendingWordId: null,
    smartQueue: null,
    isLoading: false,
  }),
}))

vi.mock('@/features/topics/components/TopicSidebar', () => ({
  TopicSidebar: ({onSelect}: {onSelect: (id: number) => void}) => (
    <div data-testid="topic-sidebar">
      <button type="button" onClick={() => onSelect(1)}>select topic</button>
    </div>
  ),
}))

vi.mock('@/features/smart-review/components/SmartReviewView', () => ({
  SmartReviewView: () => <div data-testid="smart-review" />,
}))

vi.mock('@/features/words/components/QuickAddSheet', () => ({
  QuickAddSheet: () => <div data-testid="quick-add" />,
}))

vi.mock('@/features/words/components/WordCollectionView', () => ({
  WordCollectionView: () => <div data-testid="word-collection" />,
}))

beforeEach(() => {
  const store = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
      clear: () => {
        store.clear()
      },
    },
  })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: true,
      media: '',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

function Shell() {
  return (
    <>
      <div>other</div>
    </>
  )
}

describe('StudyPage drawer lifecycle', () => {
  it('closes the drawer when leaving and re-entering the study page', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/smart-review']}>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route path="smart-review" element={<StudyPage />} />
              <Route path="other" element={<Shell />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    fireEvent.click(screen.getByRole('button', {name: 'Open sidebar'}))
    expect(document.querySelector('.mobile-drawer.open')).not.toBeNull()

    fireEvent.click(screen.getAllByText('Lexora')[0]!)
    await waitFor(() => {
      expect(document.querySelector('.mobile-drawer.open')).toBeNull()
    })
  })

  it('closes the drawer when selecting a topic', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/smart-review']}>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route path="smart-review" element={<StudyPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    fireEvent.click(screen.getByRole('button', {name: 'Open sidebar'}))
    expect(document.querySelector('.mobile-drawer.open')).not.toBeNull()

    fireEvent.click(screen.getAllByText('select topic')[0])
    await waitFor(() => {
      expect(document.querySelector('.mobile-drawer.open')).toBeNull()
    })
  })
})
