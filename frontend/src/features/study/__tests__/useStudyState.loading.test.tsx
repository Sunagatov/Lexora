import {renderHook} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'
import {useQuery} from '@tanstack/react-query'
import {useLocation} from 'react-router-dom'
import {useStudyState} from '../useStudyState'
import {useTopicState} from '../../topics/useTopicState'
import {useWordFilter} from '../../words/useWordFilter'
import {useWordUpdate} from '../../words/useWordUpdate'
import {useSmartReview} from '../../smart-review/useSmartReview'

vi.mock('@tanstack/react-query')
vi.mock('react-router-dom')
vi.mock('../../topics/useTopicState')
vi.mock('../../words/useWordFilter')
vi.mock('../../words/useWordUpdate')
vi.mock('../../smart-review/useSmartReview')

describe('useStudyState loading', () => {
  it('waits for the shared words query on the smart-review route', () => {
    vi.mocked(useLocation).mockReturnValue({pathname: '/smart-review'} as ReturnType<typeof useLocation>)
    vi.mocked(useQuery)
      .mockReturnValueOnce({data: [], isLoading: false} as never)
      .mockReturnValueOnce({data: [], isLoading: true} as never)
      .mockReturnValueOnce({data: [], isLoading: false} as never)

    vi.mocked(useTopicState).mockReturnValue({
      selectedTopicId: null,
      selectedTopic: null,
      topicCounts: new Map(),
      topicProgress: new Map(),
      topicSearch: '',
      setTopicSearch: vi.fn(),
      selectTopic: vi.fn(),
      selectSmartReview: vi.fn(),
    } as never)

    vi.mocked(useWordFilter).mockReturnValue({
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
    } as never)

    vi.mocked(useWordUpdate).mockReturnValue({
      updateLevel: vi.fn(),
      updateLevelAsync: vi.fn(),
      pendingWordId: null,
    } as never)

    vi.mocked(useSmartReview).mockReturnValue({
      queue: null,
      isLoading: false,
      completeItem: vi.fn(),
      refresh: vi.fn(),
      isRefreshing: false,
    } as never)

    const {result} = renderHook(() => useStudyState())

    expect(result.current.isLoading).toBe(true)
  })
})
