import {fireEvent, render, screen, waitFor} from '@testing-library/react'
import {createMemoryRouter, Link, RouterProvider} from 'react-router-dom'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {WordPage} from '../routes/WordPage'
import type {Word} from '../types/wordTypes'
import * as api from '../api/wordsApi'

vi.mock('../api/wordsApi')
vi.mock('@/features/topics/api/topicsApi', () => ({fetchTopics: async () => [{id: 1, name: 'Fruit', slug: 'fruit'}]}))
vi.mock('@/shared/config/usePublicConfig', () => ({usePublicConfig: () => ({data: {trash_retention_days: 30}})}))

const word = {id: 1, term: 'apple', language: 'en', topic_ids: [1], translation_entries: ['яблоко'],
  definition: null, pronunciation_ipa: null, pronunciation_audio_url: null, image_url: null,
  part_of_speech: 'noun', cefr_level: 'A1', register: null, countability: null,
  frequency_rank: null, knowledge_level: 1, pattern: null, notes: null, is_active: true,
  verb_form: null, example_entries: [], example_count: 0, example_target_count: 3,
  example_status: 'missing', needs_example_enrichment: true, synonym_entries: [],
  antonym_entries: [], collocation_entries: [], confusable_entries: [], deleted_at: null,
  created_at: '2026-10-14T00:00:00Z', updated_at: '2026-10-14T00:00:00Z'} as Word

function setup() {
  vi.mocked(api.fetchWord).mockResolvedValue(word)
  vi.mocked(api.fetchWords).mockResolvedValue([word])
  vi.mocked(api.updateWord).mockImplementation(async (_id, payload) => ({...word, ...payload} as Word))
  const router = createMemoryRouter([
    {path: '/', element: <p>Library destination</p>},
    {path: '/words/:wordId/edit', element: <><Link to="/">Lexora</Link><WordPage /></>},
    {path: '/words/:wordId', element: <WordPage />},
  ], {initialEntries: ['/words/1/edit']})
  render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
    <RouterProvider router={router} />
  </QueryClientProvider>)
  return router
}

it('keeps a changed draft when navigation is cancelled, and discards only after confirmation', async () => {
  const router = setup()
  const term = await screen.findByRole('textbox', {name: 'Term'})
  fireEvent.change(term, {target: {value: 'apple draft'}})
  fireEvent.click(screen.getByRole('link', {name: 'Lexora'}))
  await screen.findByRole('dialog', {name: 'Discard unsaved changes?'})
  expect(router.state.location.pathname).toBe('/words/1/edit')
  fireEvent.click(screen.getByRole('button', {name: 'Keep editing'}))
  expect((term as HTMLInputElement).value).toBe('apple draft')
  fireEvent.click(screen.getByRole('link', {name: 'Lexora'}))
  fireEvent.click(await screen.findByRole('button', {name: 'Discard changes'}))
  await screen.findByText('Library destination')
})

it('allows navigation after an acknowledged save without a discard warning', async () => {
  const router = setup()
  fireEvent.change(await screen.findByRole('textbox', {name: 'Term'}), {target: {value: 'new apple'}})
  fireEvent.click(screen.getByRole('button', {name: 'Save'}))
  await waitFor(() => expect(router.state.location.pathname).toBe('/words/1'))
  expect(screen.queryByRole('dialog')).toBeNull()
})
