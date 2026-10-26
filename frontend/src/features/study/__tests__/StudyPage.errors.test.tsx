import {fireEvent, render, screen, waitFor, within} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {MemoryRouter, Outlet, Route, Routes, useLocation} from 'react-router-dom'
import {beforeEach, expect, it, vi} from 'vitest'
import {StudyPage} from '../routes/StudyPage'
import * as topicsApi from '@/features/topics/api/topicsApi'
import * as wordsApi from '@/features/words/api/wordsApi'
import type {Word} from '@/features/words/types/wordTypes'

vi.mock('@/features/topics/api/topicsApi')
vi.mock('@/features/words/api/wordsApi')

const word: Word = {
  id: 1, term: 'patient', language: 'en', topic_ids: [1], knowledge_level: 1,
  translation_entries: ['терпеливый'], example_entries: [], definition: null,
  pronunciation_ipa: null, pronunciation_audio_url: null, image_url: null,
  part_of_speech: 'adjective', cefr_level: 'A1', register: null, countability: null,
  frequency_rank: null, verb_form: null, pattern: null, notes: null,
  synonym_entries: [], antonym_entries: [], collocation_entries: [], confusable_entries: [],
  example_count: 0, example_target_count: 3, example_status: 'missing', needs_example_enrichment: true,
  is_active: true, deleted_at: null, created_at: '2026-10-26', updated_at: '2026-10-26',
}
let words: Word[]

beforeEach(() => {
  vi.clearAllMocks()
  words = [structuredClone(word)]
  vi.mocked(topicsApi.fetchTopics).mockResolvedValue([{id: 1, name: 'People', slug: 'people', parent_topic_id: null, description: null, is_active: true, created_at: '2026-10-26', updated_at: '2026-10-26'}])
  vi.mocked(topicsApi.fetchTopicSidebarStats).mockResolvedValue({total_words: 1, topic_counts: {1: 1}, topic_progress: {1: 0}})
  vi.mocked(wordsApi.fetchWords).mockImplementation(async () => words)
})

function Shell() {
  const location = useLocation()
  return <><output data-testid="query">{location.search}</output><Outlet context={{drawerOpen: false, setDrawerOpen: vi.fn()}} /></>
}
function openTopic(search = '') {
  const client = new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}})
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/topics/people' + search]}>
    <Routes><Route element={<Shell />}><Route path="/topics/:topicSlug" element={<StudyPage />} /></Route></Routes>
  </MemoryRouter></QueryClientProvider>)
}

it('shows a failed rating and allows retrying the same choice', async () => {
  vi.mocked(wordsApi.updateWordKnowledgeLevel).mockRejectedValueOnce(new Error('Network unavailable'))
    .mockImplementationOnce(async (_id, level) => { words = [{...word, knowledge_level: level}]; return words[0] })
  const {container} = openTopic()
  await screen.findAllByText('patient')
  const row = container.querySelector('.word-table tbody tr') as HTMLElement
  fireEvent.click(within(row).getByRole('button', {name: 'Weak'}))
  fireEvent.click(within(screen.getByRole('group', {name: 'Knowledge level'})).getByRole('button', {name: 'Strong'}))
  expect((await screen.findByRole('alert')).textContent).toContain('Failed to save word level')
  await waitFor(() => expect(within(row).getByRole('button', {name: 'Weak'})).toBeTruthy())
  fireEvent.click(screen.getByRole('button', {name: 'Retry'}))
  await waitFor(() => expect(wordsApi.updateWordKnowledgeLevel).toHaveBeenCalledTimes(2))
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
})

it('reports loading failures, preserves the requested page, and retries successfully', async () => {
  vi.mocked(wordsApi.fetchWords).mockRejectedValueOnce(new Error('Network unavailable'))
  words = Array.from({length: 60}, (_, index) => ({...word, id: index + 1, term: `word ${index + 1}`}))
  openTopic('?page=2')
  expect((await screen.findByRole('alert')).textContent).toContain('Failed to load this topic')
  expect(screen.queryByText('No words match the current filters.')).toBeNull()
  expect(screen.getByTestId('query').textContent).toBe('?page=2')
  fireEvent.click(screen.getByRole('button', {name: 'Retry'}))
  await screen.findAllByText('word 60')
  expect(screen.getByTestId('query').textContent).toBe('?page=2')
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
})
