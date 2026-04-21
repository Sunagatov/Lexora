// noinspection JSUnusedGlobalSymbols
import {renderHook} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'
import {useStudyState} from '../useStudyState'

const useQueryMock = vi.fn()

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}))

vi.mock('react-router-dom', () => ({
  useLocation: () => ({pathname: '/smart-review'}),
  useNavigate: () => vi.fn(),
  useParams: () => ({}),
}))

vi.mock('../../topics/useTopicState', () => ({
  useTopicState: () => ({
    selectedTopicId: null,
    selectedTopic: null,
    topicCounts: new Map(),
    topicProgress: new Map(),
    topicSearch: '',
    setTopicSearch: vi.fn(),
    selectTopic: vi.fn(),
    selectSmartReview: vi.fn(),
  }),
}))

vi.mock('../../words/useWordFilter', () => ({
  useWordFilter: () => ({
    wordSearch: '',
    setWordSearch: vi.fn(),
    levelFilter: 'all',
    setLevelFilter: vi.fn(),
    sortBy: 'term',
    setSortBy: vi.fn(),
    frozenIds: null,
    setFrozenIds: vi.fn(),
    levelSummary: {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, unset: 0},
    filteredWords: [],
    pageWords: [],
    page: 1,
    totalPages: 1,
    pageSize: 20,
    setPage: vi.fn(),
    setPageSize: vi.fn(),
    pageStart: 0,
    pageEnd: 0,
    resetFilters: vi.fn(),
  }),
}))

vi.mock('../../words/useWordUpdate', () => ({
  useWordUpdate: () => ({
    updateLevel: vi.fn(),
    updateLevelAsync: vi.fn(),
    pendingWordId: null,
  }),
}))

vi.mock('../../smart-review/useSmartReview', () => ({
  useSmartReview: () => ({
    queue: null,
    isLoading: false,
    completeItem: vi.fn(),
    refresh: vi.fn(),
    isRefreshing: false,
  }),
}))

describe('useStudyState loading', () => {
  it('waits for the shared words query on the smart-review route', () => {
    useQueryMock
      .mockReturnValueOnce({data: [], isLoading: false})
      .mockReturnValueOnce({data: [], isLoading: true})
      .mockReturnValueOnce({data: [], isLoading: false})

    const {result} = renderHook(() => useStudyState())

    expect(result.current.isLoading).toBe(true)
  })
})
