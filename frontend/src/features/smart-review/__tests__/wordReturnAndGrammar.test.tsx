import {fireEvent, render, screen} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {createMemoryRouter, RouterProvider} from 'react-router-dom'
import {expect, it, vi} from 'vitest'
import {SwipeReview} from '../components/SwipeReview'
import {WordCardList} from '@/features/words/components/WordCardList'
import {WordPage} from '@/features/words/routes/WordPage'
import {WordPageView} from '@/features/words/components/WordPageView'
import * as api from '@/features/words/api/wordsApi'
import type {Word} from '@/features/words/types/wordTypes'
import type {StudyQueue} from '../types/studyQueueTypes'

vi.mock('@/features/words/api/wordsApi', () => ({fetchWord: vi.fn(), fetchWords: vi.fn(), updateWord: vi.fn(),
  deleteWord: vi.fn(), enrichWord: vi.fn()}))
vi.mock('@/features/topics/api/topicsApi', () => ({fetchTopics: vi.fn(async () =>
  [{id: 1, name: 'Inbox', slug: 'inbox', parent_topic_id: null}])}))
vi.mock('@/features/words/hooks/useWordUpdate', () => ({useWordUpdate: () => ({updateLevelAsync: vi.fn()})}))
vi.mock('../hooks/useSmartReview', () => ({useSmartReview: () => ({completeItemAsync: vi.fn()})}))
vi.mock('@/shared/config/usePublicConfig', () => ({usePublicConfig: () => ({data: {trash_retention_days: 30}})}))

it.each(['list', 'swipe'])('returns to Daily Mix after opening word details from %s', async view => {
  const word = {id: 1, term: 'hello', language: 'en', topic_ids: [1], translation_entries: ['greeting'],
    example_entries: [], synonym_entries: [], antonym_entries: [], collocation_entries: [], confusable_entries: [],
    knowledge_level: 1, part_of_speech: 'noun', verb_form: null, created_at: '', updated_at: ''} as unknown as Word
  vi.mocked(api.fetchWord).mockResolvedValue(word)
  vi.mocked(api.fetchWords).mockResolvedValue([word])
  const queue = {id: 1, generated_at: '', expires_at: '', is_active: true, total_count: 1, completed_count: 0,
    items: [{id: 101, word_id: 1, position: 0, word, is_completed: false, completed_at: null}]} as StudyQueue
  const router = createMemoryRouter([
    {path: '/smart-review', element: view === 'swipe'
      ? <SwipeReview queue={queue} onBackToList={vi.fn()} onBusyChange={vi.fn()} />
      : <WordCardList words={[word]} pendingWordId={null} onUpdate={vi.fn()} />},
    {path: '/words/:wordId', element: <WordPage />},
    {path: '/topics/inbox', element: <div>Inbox topic</div>},
  ], {initialEntries: ['/smart-review']})
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}})
  render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>)
  fireEvent.click(document.querySelector('a[href="/words/1"]')!)
  await screen.findByRole('button', {name: 'Back'})
  fireEvent.click(screen.getByRole('button', {name: 'Back'}))
  expect(router.state.location.pathname).toBe('/smart-review')
})

it.each(['verb', 'noun'])('shows verb-only grammar only for an appropriate POS: %s', part_of_speech => {
  const word = {id: 1, term: 'run', language: 'en', topic_ids: [], translation_entries: [],
    example_entries: [], synonym_entries: [], antonym_entries: [], collocation_entries: [], confusable_entries: [],
    part_of_speech, verb_form: {past_simple: 'ran', past_participle: 'run'}} as unknown as Word
  render(<WordPageView word={word} topics={[]} />)
  if (part_of_speech === 'verb') expect(screen.getByRole('heading', {name: 'Verb Forms'})).toBeTruthy()
  else expect(screen.queryByRole('heading', {name: 'Verb Forms'})).toBeNull()
})
