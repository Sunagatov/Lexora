import {act, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {MemoryRouter, useLocation} from 'react-router-dom'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {fetchWordList, fetchWordKnowledgeSummary, updateWordKnowledgeLevel, type WordListResponse} from '@/features/words/api/wordsApi'
import {useVocabulary} from '@/features/words/hooks/useVocabulary'
import {useWordUpdate} from '@/features/words/hooks/useWordUpdate'
import type {Word} from '@/features/words/types/wordTypes'
import {queryKeys} from '@/app/queryKeys'
import {invalidateWordDependencies} from '@/features/words/model/wordCache'

vi.mock('@/features/words/api/wordsApi')

function Probe() {
  const s = useVocabulary()
  const update = useWordUpdate(() => {})
  const location = useLocation()
  return <>
    <span data-testid="state">{JSON.stringify({page: s.page, totalPages: s.totalPages, error: s.wordsQuery.isError, pageSize: s.pageSize, sort: s.sortBy, total: s.summaryQuery.data?.total, strong: s.summaryQuery.data?.level_counts[4], search: location.search})}</span>
    <button onClick={() => s.setPage(2)}>Next</button>
    <button onClick={() => s.setPage(1)}>Previous</button>
    <button onClick={() => s.setPageSize(100)}>100 per page</button>
    <button onClick={() => s.setCefrFilter('A1')}>A1</button>
    <button onClick={s.resetFilters}>Reset</button>
    <button onClick={() => update.updateLevel(1, 4)}>Mark strong</button>
    <span data-testid="words">{JSON.stringify(s.wordsQuery.data?.words.map(word => [word.id, word.knowledge_level]))}</span>
  </>
}
function setup(entry = '/') {
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}})
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[entry]}><Probe /></MemoryRouter></QueryClientProvider>)
  return client
}
const page = (number = 1): WordListResponse => ({words: [], total: 200, page: number, page_size: 50, total_pages: 4})
const state = () => JSON.parse(screen.getByTestId('state').textContent!)
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(fetchWordList).mockImplementation(params => Promise.resolve(page(params?.page)))
  vi.mocked(fetchWordKnowledgeSummary).mockResolvedValue({total: 200, level_counts: {1: 150, 4: 50}})
})

it('starts with all words, Weak/CEFR sort, and 50 per page', async () => {
  setup()
  await waitFor(() => expect(state().total).toBe(200))
  expect(fetchWordList).toHaveBeenCalledWith(expect.objectContaining({page: 1, pageSize: 50, sort: 'level-asc', level: undefined, cefr: undefined}))
})

it.each([[200, 200], [20, 50]])('resolves pageSize=%s to %s', async (requested, expected) => {
  setup(`/?pageSize=${requested}`)
  await waitFor(() => expect(fetchWordList).toHaveBeenCalledWith(expect.objectContaining({pageSize: expected})))
})

it('saves a level and updates progress without dropping or moving the reviewed row', async () => {
  const alpha = {id: 1, term: 'alpha', knowledge_level: 1} as Word
  const beta = {id: 2, term: 'beta', knowledge_level: 1} as Word
  let saved = false
  vi.mocked(fetchWordList).mockImplementation(async () => ({...page(), words: saved ? [beta] : [alpha, beta]}))
  vi.mocked(updateWordKnowledgeLevel).mockImplementation(async () => {
    saved = true
    return {...alpha, knowledge_level: 4}
  })
  vi.mocked(fetchWordKnowledgeSummary).mockImplementation(async () => ({total: 200, level_counts: {1: saved ? 149 : 150, 4: saved ? 51 : 50}}))
  setup('/?level=1')
  await waitFor(() => expect(screen.getByTestId('words').textContent).toBe('[[1,1],[2,1]]'))
  fireEvent.click(screen.getByText('Mark strong'))
  await waitFor(() => expect(state().strong).toBe(51))
  expect(screen.getByTestId('words').textContent).toBe('[[1,4],[2,1]]')
  expect(fetchWordList).toHaveBeenCalledTimes(1)
  expect(updateWordKnowledgeLevel).toHaveBeenCalledWith(1, 4, expect.any(String))
  fireEvent.click(screen.getByText('A1'))
  await waitFor(() => expect(screen.getByTestId('words').textContent).toBe('[[2,1]]'))
  expect(fetchWordList).toHaveBeenCalledTimes(2)
})

it('reapplies saved levels when paging and still refreshes the list for ordinary edits', async () => {
  const alpha = {id: 1, term: 'alpha', knowledge_level: 1} as Word
  let saved = false
  vi.mocked(fetchWordList).mockImplementation(async params => ({...page(params?.page), words: saved ? [] : [alpha]}))
  vi.mocked(updateWordKnowledgeLevel).mockImplementation(async () => {
    saved = true
    return {...alpha, knowledge_level: 4}
  })
  const client = setup('/?level=1')
  await waitFor(() => expect(screen.getByTestId('words').textContent).toBe('[[1,1]]'))
  fireEvent.click(screen.getByText('Mark strong'))
  await waitFor(() => expect(screen.getByTestId('words').textContent).toBe('[[1,4]]'))
  expect(fetchWordList).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByText('Next'))
  await waitFor(() => expect(screen.getByTestId('words').textContent).toBe('[]'))
  expect(state().page).toBe(2)
  await act(async () => { invalidateWordDependencies(client) })
  await waitFor(() => expect(fetchWordList).toHaveBeenCalledTimes(3))
})

it('keeps inactive review pages for level changes but discards them after other edits', () => {
  const client = new QueryClient()
  const key = [...queryKeys.wordList, {page: 1}]
  client.setQueryData(key, page())
  invalidateWordDependencies(client, [], {preserveWordPages: true})
  expect(client.getQueryData(key)).toEqual(page())
  expect(client.getQueryState(key)?.isInvalidated).toBe(true)
  invalidateWordDependencies(client)
  expect(client.getQueryData(key)).toBeUndefined()
})

it('preserves page 2 while its response is loading', async () => {
  let resolve!: (value: WordListResponse) => void
  const pending = new Promise<WordListResponse>(res => { resolve = res })
  vi.mocked(fetchWordList).mockImplementation(params => params?.page === 2 ? pending : Promise.resolve(page()))
  setup()
  await waitFor(() => expect(state().total).toBe(200))
  fireEvent.click(screen.getByText('Next'))
  await waitFor(() => expect(fetchWordList).toHaveBeenCalledWith(expect.objectContaining({page: 2})))
  expect(state().page).toBe(2)
  expect(state().totalPages).toBe(4)
  await act(async () => { resolve(page(2)); await pending })
  expect(state().page).toBe(2)
})

it('resets the page when filtering, keeps global progress, and resets to defaults', async () => {
  setup('/?page=2&pageSize=100&sort=term-desc')
  await waitFor(() => expect(state().total).toBe(200))
  fireEvent.click(screen.getByText('A1'))
  await waitFor(() => expect(fetchWordList).toHaveBeenCalledWith(expect.objectContaining({page: 1, cefr: 'A1', pageSize: 100})))
  expect(state().strong).toBe(50)
  expect(fetchWordKnowledgeSummary).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByText('Reset'))
  await waitFor(() => expect(state()).toMatchObject({page: 1, pageSize: 50, sort: 'level-asc', search: ''}))
})

it('keeps Previous available when the next page fails to load', async () => {
  vi.mocked(fetchWordList).mockImplementation(params => params?.page === 2 ? Promise.reject(new Error('Server unavailable')) : Promise.resolve(page()))
  setup()
  await waitFor(() => expect(state().totalPages).toBe(4))
  fireEvent.click(screen.getByText('Next'))
  await waitFor(() => expect(state().error).toBe(true))
  expect(state()).toMatchObject({page: 2, totalPages: 4})
  fireEvent.click(screen.getByText('Previous'))
  await waitFor(() => expect(state()).toMatchObject({page: 1, error: false, totalPages: 4}))
})

it('returns to page one when changing page size', async () => {
  setup('/?page=3')
  await waitFor(() => expect(fetchWordList).toHaveBeenCalledWith(expect.objectContaining({page: 3})))
  fireEvent.click(screen.getByText('100 per page'))
  await waitFor(() => expect(fetchWordList).toHaveBeenCalledWith(expect.objectContaining({page: 1, pageSize: 100})))
  expect(state().page).toBe(1)
})

it('invalidates the whole-library summary after word changes', () => {
  const client = new QueryClient()
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  invalidateWordDependencies(client)
  expect(invalidate).toHaveBeenCalledWith({queryKey: queryKeys.wordSummary})
})
