import {act, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {MemoryRouter} from 'react-router-dom'
import {beforeEach, expect, it, vi} from 'vitest'
import {fetchTopics, fetchTopicSidebarStats} from '@/features/topics/api/topicsApi'
import {AccountSidebar} from './AccountSidebar'

vi.mock('@/features/topics/api/topicsApi', async () => ({
  ...await vi.importActual('@/features/topics/api/topicsApi'),
  fetchTopics: vi.fn(), fetchTopicSidebarStats: vi.fn(),
}))

const topics = [{id: 1, name: 'Travel', slug: 'travel', description: null, is_active: true,
  parent_topic_id: null, created_at: '', updated_at: ''}]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(fetchTopics).mockResolvedValue(topics)
  vi.mocked(fetchTopicSidebarStats).mockResolvedValue({total_words: 2, topic_counts: {'1': 2}, topic_progress: {'1': 50}})
})

function setup() {
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}})
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/account/study']}>
    <AccountSidebar onClose={vi.fn()} />
  </MemoryRouter></QueryClientProvider>)
  return client
}

it('shows a loading state instead of claiming the library is empty', async () => {
  let finish!: (value: typeof topics) => void
  vi.mocked(fetchTopics).mockImplementationOnce(() => new Promise(resolve => {finish = resolve}))
  setup()
  expect(screen.getByRole('status').textContent).toContain('Loading topics')
  expect(screen.queryByText('No topics found.')).toBeNull()
  await act(async () => {finish(topics)})
  expect(await screen.findByText('Travel')).toBeTruthy()
})

it('distinguishes a failed request from an empty library and retries without closing', async () => {
  vi.mocked(fetchTopics).mockRejectedValueOnce(new Error('Temporary server error'))
  setup()
  expect((await screen.findByRole('alert')).textContent).toContain('Could not load topics')
  expect(screen.queryByText('No topics found.')).toBeNull()
  fireEvent.click(screen.getByRole('button', {name: 'Retry'}))
  expect(await screen.findByText('Travel')).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
})

it('keeps cached topics visible when a background refresh fails', async () => {
  const client = setup()
  await screen.findByText('Travel')
  vi.mocked(fetchTopics).mockRejectedValueOnce(new Error('Temporary server error'))
  await act(async () => {await client.invalidateQueries({queryKey: ['topics']})})
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Could not load topics'))
  expect(screen.getByText('Travel')).toBeTruthy()
})

it('offers retry when only topic progress fails', async () => {
  vi.mocked(fetchTopicSidebarStats).mockRejectedValueOnce(new Error('Temporary server error'))
  setup()
  expect((await screen.findByRole('alert')).textContent).toContain('Could not load topic progress')
  expect(screen.getByText('Travel')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', {name: 'Retry'}))
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
})
