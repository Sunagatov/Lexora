import {act, renderHook, waitFor} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {MemoryRouter, Routes, Route} from 'react-router-dom'
import type {ReactNode} from 'react'
import {expect, it, vi} from 'vitest'
import {useWordPageState} from '@/features/words/hooks/useWordPageState'
import * as api from '@/features/words/api/wordsApi'
import type {Word, EnrichResult} from '@/features/words/types/wordTypes'

vi.mock('@/features/words/api/wordsApi', () => ({fetchWord: vi.fn(), fetchWords: vi.fn(), updateWord: vi.fn(),
  deleteWord: vi.fn(), enrichWord: vi.fn()}))
vi.mock('@/features/topics/api/topicsApi', () => ({fetchTopics: vi.fn(async () =>
  [{id: 1, name: 'Inbox', slug: 'inbox', parent_topic_id: null}])}))

it.each([
  {language: 'en', examples: ['EN: Hello!\nRU: Привет!', 'EN: Goodbye!\nRU: Пока!']},
  {language: 'ru', examples: ['RU: Привет!\nEN: Hello!', 'RU: Пока!\nEN: Bye!', 'RU: Спасибо!\nEN: Thanks!']},
  {language: 'en', examples: ['EN: Hello!\nEN: Hi!', 'EN: Goodbye!\nEN: Bye!', 'EN: Thanks!\nEN: Thank you!']},
])('preserves enriched example entries when saving a $language word', async ({language, examples}) => {
  const word = {id: 1, term: 'hello', language, topic_ids: [1], translation_entries: [], example_entries: [],
    synonym_entries: [], antonym_entries: [], collocation_entries: [], knowledge_level: 1,
    part_of_speech: null, verb_form: null, frequency_rank: null} as unknown as Word
  vi.mocked(api.fetchWord).mockResolvedValue(word)
  vi.mocked(api.fetchWords).mockResolvedValue([word])
  vi.mocked(api.updateWord).mockReset().mockResolvedValue(word)
  vi.mocked(api.enrichWord).mockResolvedValue({example_entries: examples, translation_entries: ['greeting'],
    synonym_entries: [], antonym_entries: [], collocation_entries: []} as unknown as EnrichResult)
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}})
  const wrapper = ({children}: {children: ReactNode}) => <QueryClientProvider client={client}>
    <MemoryRouter initialEntries={['/words/1/edit']}><Routes>
      <Route path='/words/:wordId/edit' element={children} />
    </Routes></MemoryRouter></QueryClientProvider>
  const {result} = renderHook(() => useWordPageState(), {wrapper})
  await waitFor(() => expect(result.current.draft).not.toBeNull())
  await act(async () => {await result.current.handleEnrich()})
  act(() => result.current.save())
  await waitFor(() => expect(api.updateWord).toHaveBeenCalled())
  expect(vi.mocked(api.updateWord).mock.calls[0][1].example_entries).toEqual(examples)
})
