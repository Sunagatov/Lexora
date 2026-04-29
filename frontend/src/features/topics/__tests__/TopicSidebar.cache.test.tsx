import {render, screen, fireEvent, waitFor} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {describe, expect, it, vi, beforeEach} from 'vitest'
import {MemoryRouter} from 'react-router-dom'
import {TopicSidebar} from '../TopicSidebar'
import {useTopicSidebarPrefs} from '../useTopicSidebarPrefs'
import {queryKeys} from '../../../app/queryKeys'
import type {Topic} from '../../../shared/types'
import {ApiError} from '../../../shared/apiError'
import * as topicsApi from '../api'

vi.mock('../useTopicSidebarPrefs')
vi.mock('../api')

const navigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigate,
  }
})

function makeTopic(id: number, name: string, slug = name.toLowerCase()): Topic {
  return {
    id,
    name,
    slug,
    description: null,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }
}

function renderSidebar(queryClient: QueryClient, topics: Topic[]) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TopicSidebar
          topics={topics}
          topicCounts={new Map()}
          topicProgress={new Map()}
          totalWords={0}
          topicSearch=""
          setTopicSearch={vi.fn()}
          selectedTopicId={null}
          isSmartReview={false}
          onSelect={vi.fn()}
          onSelectSmartReview={vi.fn()}
          smartQueue={null}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('TopicSidebar cache invalidation', () => {
  beforeEach(() => {
    navigate.mockReset()
    vi.clearAllMocks()
    vi.mocked(useTopicSidebarPrefs).mockReturnValue({
      posCollapsed: false,
      setPosCollapsed: vi.fn(),
      topicsCollapsed: false,
      setTopicsCollapsed: vi.fn(),
      posSort: 'default',
      setPosSort: vi.fn(),
      topicsSort: 'default',
      setTopicsSort: vi.fn(),
      pinnedIds: [],
      togglePin: vi.fn(),
      recentIds: [],
      addRecentId: vi.fn(),
      expandedTopicIds: [],
      toggleTopicExpanded: vi.fn(),
      setExpandedTopicIds: vi.fn(),
    } as never)
    vi.mocked(topicsApi.createTopic).mockResolvedValue(makeTopic(2, 'New topic', 'new-topic'))
    vi.mocked(topicsApi.deleteTopic).mockResolvedValue(undefined)
  })

  it('invalidates stats after creating a topic', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderSidebar(queryClient, [makeTopic(1, 'Alpha', 'alpha')])

    fireEvent.click(screen.getByText('+ New topic'))
    fireEvent.change(screen.getByPlaceholderText('Topic name…'), {target: {value: 'New topic'}})
    fireEvent.click(screen.getByRole('button', {name: 'Add'}))

    await waitFor(() => {
      expect(topicsApi.createTopic).toHaveBeenCalledWith('New topic', null)
    })

    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.stats})
  })

  it('shows backend topic-create conflict details instead of flattening them to a generic message', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })

    vi.mocked(topicsApi.createTopic).mockRejectedValueOnce(
      new ApiError(409, "Topic slug 'inbox' is used by a deleted topic — restore or permanently delete it first"),
    )

    renderSidebar(queryClient, [makeTopic(1, 'Alpha', 'alpha')])

    fireEvent.click(screen.getByText('+ New topic'))
    fireEvent.change(screen.getByPlaceholderText('Topic name…'), {target: {value: 'Inbox'}})
    fireEvent.click(screen.getByRole('button', {name: 'Add'}))

    await waitFor(() => {
      expect(topicsApi.createTopic).toHaveBeenCalledWith('Inbox', null)
    })

    expect(
      screen.getByText("Topic slug 'inbox' is used by a deleted topic — restore or permanently delete it first"),
    ).toBeTruthy()
  })

  it('invalidates the topic, word, sidebar, stats, smart review, and trash caches after deleting a topic', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    renderSidebar(queryClient, [makeTopic(1, 'Alpha', 'alpha')])

    fireEvent.click(screen.getByTitle('Delete topic'))
    fireEvent.click(screen.getByRole('button', {name: 'Delete'}))

    await waitFor(() => {
      expect(topicsApi.deleteTopic).toHaveBeenCalledWith(1, false)
    })

    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.topics})
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.words})
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.topicSidebar})
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.stats})
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.smartReview})
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.trashWords})
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.trashTopics})
  })

  it('describes deletion impact in terms that match backend behavior', () => {
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })

    renderSidebar(queryClient, [makeTopic(1, 'Alpha', 'alpha')])

    fireEvent.click(screen.getByTitle('Delete topic'))

    expect(
      screen.getByText(/Words that would lose their last active topic will also be trashed/i),
    ).toBeTruthy()
    expect(
      screen.getByText(/words that still belong to another active topic will stay available/i),
    ).toBeTruthy()
  })

  it('shows backend delete constraints when a topic cannot be deleted', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })

    vi.mocked(topicsApi.deleteTopic).mockRejectedValueOnce(
      new ApiError(409, 'Cannot delete topic while active subtopics exist: Subtopic A'),
    )

    renderSidebar(queryClient, [makeTopic(1, 'Alpha', 'alpha')])

    fireEvent.click(screen.getByTitle('Delete topic'))
    fireEvent.click(screen.getByRole('button', {name: 'Delete'}))

    await waitFor(() => {
      expect(topicsApi.deleteTopic).toHaveBeenCalledWith(1, false)
    })

    expect(
      screen.getByText('Cannot delete topic while active subtopics exist: Subtopic A'),
    ).toBeTruthy()
    expect(screen.getByRole('button', {name: 'Delete'})).toBeTruthy()
  })

  it('invalidates sidebar stats after editing a topic because reparenting changes backend subtree totals', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    vi.mocked(topicsApi.updateTopic).mockResolvedValue({
      ...makeTopic(1, 'Alpha', 'alpha'),
      parent_topic_id: 2,
    } as Topic)

    renderSidebar(queryClient, [makeTopic(1, 'Alpha', 'alpha'), makeTopic(2, 'Parent', 'parent')])

    fireEvent.click(screen.getAllByTitle('Edit topic')[0])
    fireEvent.change(screen.getByLabelText('Parent topic'), {target: {value: '2'}})
    fireEvent.click(screen.getByRole('button', {name: 'Save'}))

    await waitFor(() => {
      expect(topicsApi.updateTopic).toHaveBeenCalledWith(1, {
        name: 'Alpha',
        description: null,
        parent_topic_id: 2,
      })
    })

    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.topicSidebar})
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.stats})
  })
})
