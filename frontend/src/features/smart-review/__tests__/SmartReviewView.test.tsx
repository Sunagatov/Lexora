import {fireEvent, render, screen, waitFor} from '@testing-library/react'
import {describe, expect, it, vi, beforeEach} from 'vitest'
import type {StudyQueue} from '@/features/smart-review/types/studyQueueTypes'
import type {Word} from '@/features/words/types/wordTypes'
import {SmartReviewView} from '@/features/smart-review/components/SmartReviewView'
import {useSmartReview} from '@/features/smart-review/hooks/useSmartReview'
import {useWordUpdate} from '@/features/words/hooks/useWordUpdate'
import {useWordFilter} from '@/features/words/hooks/useWordFilter'

vi.mock('@/features/smart-review/hooks/useSmartReview')
vi.mock('@/features/words/hooks/useWordUpdate')
vi.mock('@/features/words/hooks/useWordFilter')
vi.mock('@/features/words/components/WordCollectionView', () => ({
  WordCollectionView: ({pageWords, onUpdate}: {pageWords: Word[]; onUpdate: (wordId: number, level: 1 | 2 | 3 | 4 | 5) => void}) => (
    <button type="button" onClick={() => onUpdate(pageWords[0]?.id ?? 0, 3)}>
      review first
    </button>
  ),
}))

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

function makeQueue(word: Word, isCompleted = false): StudyQueue {
  return {
    id: 1,
    generated_at: '2024-01-01T00:00:00Z',
    expires_at: '2024-01-02T00:00:00Z',
    is_active: true,
    total_count: 1,
    completed_count: isCompleted ? 1 : 0,
    items: [
      {
        id: 101,
        word_id: word.id,
        position: 1,
        is_completed: isCompleted,
        completed_at: isCompleted ? '2024-01-01T00:05:00Z' : null,
        word,
      },
    ],
  }
}

function mockMatchMedia(matches: boolean) {
  const media = {
    matches,
    media: '(max-width: 860px)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn(() => media),
  })
}

describe('SmartReviewView', () => {
  const completeItem = vi.fn()
  const refresh = vi.fn()
  const updateLevelAsync = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useSmartReview).mockReturnValue({
      queue: makeQueue(makeWord(11, 'run')),
      isLoading: false,
      completeItem,
      refresh,
      isRefreshing: false,
    } as never)
    vi.mocked(useWordUpdate).mockReturnValue({
      updateLevel: vi.fn(),
      updateLevelAsync,
      pendingWordId: null,
    } as never)
    vi.mocked(useWordFilter).mockReturnValue({
      wordSearch: '',
      setWordSearch: vi.fn(),
      levelFilter: 'all',
      setLevelFilter: vi.fn(),
      sortBy: 'level-asc',
      setSortBy: vi.fn(),
      frozenIds: null,
      setFrozenIds: vi.fn(),
      levelSummary: {1: 0, 2: 1, 3: 0, 4: 0, 5: 0, unset: 0},
      filteredWords: [makeWord(11, 'run')],
      pageWords: [makeWord(11, 'run')],
      page: 1,
      totalPages: 1,
      pageSize: 20,
      setPage: vi.fn(),
      setPageSize: vi.fn(),
      pageStart: 1,
      pageEnd: 1,
      resetFilters: vi.fn(),
    } as never)
  })

  it('uses the desktop default page size on wide screens', () => {
    mockMatchMedia(false)
    render(<SmartReviewView queue={makeQueue(makeWord(11, 'run'))} isLoading={false} />)

    expect(vi.mocked(useWordFilter)).toHaveBeenCalledWith(expect.any(Array), {defaultPageSize: 40})
  })

  it('uses the mobile default page size on narrow screens', () => {
    mockMatchMedia(true)

    render(<SmartReviewView queue={makeQueue(makeWord(11, 'run'))} isLoading={false} />)

    expect(vi.mocked(useWordFilter)).toHaveBeenCalledWith(expect.any(Array), {defaultPageSize: 20})
  })

  it('does not complete the queue item when the level update fails', async () => {
    updateLevelAsync.mockRejectedValueOnce(new Error('network'))

    render(<SmartReviewView queue={makeQueue(makeWord(11, 'run'))} isLoading={false} />)
    fireEvent.click(screen.getByRole('button', {name: 'review first'}))

    await waitFor(() => {
      expect(updateLevelAsync).toHaveBeenCalledWith(11, 3)
    })
    expect(completeItem).not.toHaveBeenCalled()
  })

  it('completes the queue item only after a successful level update', async () => {
    updateLevelAsync.mockResolvedValueOnce({} as never)

    render(<SmartReviewView queue={makeQueue(makeWord(11, 'run'))} isLoading={false} />)
    fireEvent.click(screen.getByRole('button', {name: 'review first'}))

    await waitFor(() => {
      expect(updateLevelAsync).toHaveBeenCalledWith(11, 3)
      expect(completeItem).toHaveBeenCalledWith(101)
    })
  })

  it('does not re-complete an item that is already completed', async () => {
    updateLevelAsync.mockResolvedValueOnce({} as never)
    const queue = makeQueue(makeWord(11, 'run'), true)
    vi.mocked(useSmartReview).mockReturnValue({
      queue,
      isLoading: false,
      completeItem,
      refresh,
      isRefreshing: false,
    } as never)

    render(<SmartReviewView queue={queue} isLoading={false} />)
    fireEvent.click(screen.getByRole('button', {name: 'review first'}))

    await waitFor(() => {
      expect(updateLevelAsync).toHaveBeenCalledWith(11, 3)
    })
    expect(completeItem).not.toHaveBeenCalled()
  })
})
