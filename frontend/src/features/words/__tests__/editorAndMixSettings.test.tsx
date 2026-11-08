import {act, render, renderHook, screen, waitFor} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {MemoryRouter, Routes, Route} from 'react-router-dom'
import type {ReactNode} from 'react'
import {expect, it, vi} from 'vitest'
import {useWordPageState} from '../hooks/useWordPageState'
import * as api from '../api/wordsApi'
import type {Word} from '../types/wordTypes'
import {SmartReviewView} from '@/features/smart-review/components/SmartReviewView'
import type {StudyQueue} from '@/features/smart-review/types/studyQueueTypes'

const settings = vi.hoisted(() => ({pageSize: 50}))
vi.mock('../api/wordsApi', () => ({fetchWord: vi.fn(), fetchWords: vi.fn(), updateWord: vi.fn(),
  deleteWord: vi.fn(), enrichWord: vi.fn(), updateWordKnowledgeLevel: vi.fn()}))
vi.mock('@/features/topics/api/topicsApi', () => ({fetchTopics: vi.fn(async () =>
  [{id: 1, name: 'Inbox', slug: 'inbox', parent_topic_id: null}])}))
vi.mock('@/features/smart-review/hooks/useSmartReview', () => ({useSmartReview: () => ({
  completeItem: vi.fn(), refresh: vi.fn(), isRefreshing: false})}))
vi.mock('@/features/preferences/api', async () => {
  const original = await vi.importActual<typeof import('@/features/preferences/api')>('@/features/preferences/api')
  const snapshots = Object.fromEntries([50, 200].map(size => [size, {
    ...original.preferencesSnapshot(), values: {...original.DEFAULT_PREFERENCES, page_size: size},
  }]))
  return {...original, usePreferences: () => ({...original.DEFAULT_PREFERENCES, page_size: settings.pageSize}),
    preferencesSnapshot: () => snapshots[settings.pageSize]}
})

const word = {id: 1, term: 'hello', language: 'en', topic_ids: [1], translation_entries: ['привет'],
  example_entries: [], synonym_entries: [], antonym_entries: [], collocation_entries: [], confusable_entries: [],
  knowledge_level: 1, part_of_speech: 'noun', verb_form: null, frequency_rank: null,
  pronunciation_ipa: '/həˈləʊ/', notes: 'original note', created_at: '', updated_at: ''} as unknown as Word

it.each(['notes', 'term'] as const)('does not write anything after reverting an edit to %s', async field => {
  vi.mocked(api.fetchWord).mockResolvedValue(word)
  vi.mocked(api.fetchWords).mockResolvedValue([word])
  vi.mocked(api.updateWord).mockReset().mockResolvedValue(word)
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}})
  const wrapper = ({children}: {children: ReactNode}) => <QueryClientProvider client={client}>
    <MemoryRouter initialEntries={['/words/1/edit']}><Routes>
      <Route path='/words/:wordId/edit' element={children} />
    </Routes></MemoryRouter></QueryClientProvider>
  const {result} = renderHook(() => useWordPageState(), {wrapper})
  await waitFor(() => expect(result.current.draft).not.toBeNull())
  act(() => result.current.set(field, word[field]! + 'x'))
  act(() => result.current.set(field, word[field]!))
  await act(async () => result.current.save())
  expect(api.updateWord).not.toHaveBeenCalled()
})

it.each([50, 200])('uses the saved %s-words page preference when opening Daily Mix', pageSize => {
  settings.pageSize = pageSize
  const queue = {id: 1, generated_at: '', expires_at: '', is_active: true, total_count: 1, completed_count: 0,
    items: [{id: 101, word_id: word.id, position: 0, word, is_completed: false, completed_at: null}]} as StudyQueue
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}})
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/smart-review']}>
    <SmartReviewView queue={queue} isLoading={false} />
  </MemoryRouter></QueryClientProvider>)
  for (const select of screen.getAllByRole('combobox', {name: 'Words per page'})) {
    expect((select as HTMLSelectElement).value).toBe(String(pageSize))
  }
})
