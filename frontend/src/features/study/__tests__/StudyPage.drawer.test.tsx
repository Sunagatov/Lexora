import {render, screen, fireEvent, waitFor} from '@testing-library/react'
import {MemoryRouter, Route, Routes, useNavigate} from 'react-router-dom'
import {describe, expect, it, vi} from 'vitest'
import {DrawerProvider, useDrawer} from '../../../shared/DrawerContext'
import {StudyPage} from '../StudyPage'

vi.mock('../useStudyState', () => ({
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

vi.mock('../../topics/TopicSidebar', () => ({
  TopicSidebar: () => <div data-testid="topic-sidebar" />,
}))

vi.mock('../../smart-review/SmartReviewView', () => ({
  SmartReviewView: () => <div data-testid="smart-review" />,
}))

vi.mock('../../words/QuickAddSheet', () => ({
  QuickAddSheet: () => <div data-testid="quick-add" />,
}))

vi.mock('../../words/WordCollectionView', () => ({
  WordCollectionView: () => <div data-testid="word-collection" />,
}))

function Shell() {
  const navigate = useNavigate()
  const {drawerOpen, setDrawerOpen} = useDrawer()

  return (
    <>
      <div data-testid="drawer-state">{drawerOpen ? 'open' : 'closed'}</div>
      <button type="button" onClick={() => setDrawerOpen(true)}>open drawer</button>
      <button type="button" onClick={() => navigate('/other')}>other</button>
      <button type="button" onClick={() => navigate('/study')}>study</button>
    </>
  )
}

describe('StudyPage drawer lifecycle', () => {
  it('closes the drawer when leaving and re-entering the study page', async () => {
    render(
      <DrawerProvider>
        <MemoryRouter initialEntries={['/study']}>
          <Shell />
          <Routes>
            <Route path="/study" element={<StudyPage />} />
            <Route path="/other" element={<div>other</div>} />
          </Routes>
        </MemoryRouter>
      </DrawerProvider>,
    )

    fireEvent.click(screen.getByText('open drawer'))
    expect(screen.getByTestId('drawer-state').textContent).toBe('open')

    fireEvent.click(screen.getByText('other'))
    await waitFor(() => {
      expect(screen.getByTestId('drawer-state').textContent).toBe('closed')
    })

    fireEvent.click(screen.getByText('study'))
    await waitFor(() => {
      expect(screen.getByTestId('drawer-state').textContent).toBe('closed')
      expect(document.querySelector('.mobile-drawer.open')).toBeNull()
    })
  })
})
