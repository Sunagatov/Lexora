import {act, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {MemoryRouter, useLocation} from 'react-router-dom'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {fetchWordList, fetchWordKnowledgeSummary, type WordListResponse} from '@/features/words/api/wordsApi'
import {useVocabulary} from '@/features/words/hooks/useVocabulary'
import {queryKeys} from '@/app/queryKeys'
import {invalidateWordDependencies} from '@/features/words/model/wordCache'

vi.mock('@/features/words/api/wordsApi')

function Probe() {
  const s = useVocabulary()
  const location = useLocation()
  return <>
    <span data-testid="state">{JSON.stringify({page: s.page, pageSize: s.pageSize, sort: s.sortBy, total: s.summaryQuery.data?.total, strong: s.summaryQuery.data?.level_counts[4], search: location.search})}</span>
    <button onClick={() => s.setPage(2)}>Next</button>
    <button onClick={() => s.setCefrFilter('A1')}>A1</button>
    <button onClick={s.resetFilters}>Reset</button>
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

it('preserves page 2 while its response is loading', async () => {
  let resolve!: (value: WordListResponse) => void
  const pending = new Promise<WordListResponse>(res => { resolve = res })
  vi.mocked(fetchWordList).mockImplementation(params => params?.page === 2 ? pending : Promise.resolve(page()))
  setup()
  await waitFor(() => expect(state().total).toBe(200))
  fireEvent.click(screen.getByText('Next'))
  await waitFor(() => expect(fetchWordList).toHaveBeenCalledWith(expect.objectContaining({page: 2})))
  expect(state().page).toBe(2)
  await act(async () => { resolve(page(2)); await pending })
  expect(state().page).toBe(2)
})

it('resets the page when filtering, keeps global progress, and resets to defaults', async () => {
  setup('/?page=2&pageSize=20&sort=term-desc')
  await waitFor(() => expect(state().total).toBe(200))
  fireEvent.click(screen.getByText('A1'))
  await waitFor(() => expect(fetchWordList).toHaveBeenCalledWith(expect.objectContaining({page: 1, cefr: 'A1', pageSize: 20})))
  expect(state().strong).toBe(50)
  expect(fetchWordKnowledgeSummary).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByText('Reset'))
  await waitFor(() => expect(state()).toMatchObject({page: 1, pageSize: 50, sort: 'level-asc', search: ''}))
})

it('invalidates the whole-library summary after word changes', () => {
  const client = new QueryClient()
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  invalidateWordDependencies(client)
  expect(invalidate).toHaveBeenCalledWith({queryKey: queryKeys.wordSummary})
})
