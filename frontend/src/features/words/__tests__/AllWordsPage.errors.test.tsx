import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react'
import {MemoryRouter} from 'react-router-dom'
import {AllWordsPage} from '@/features/words/routes/AllWordsPage'
import {fetchWordList, fetchWordKnowledgeSummary, batchUpdateWords} from '@/features/words/api/wordsApi'
import {fetchTopics} from '@/features/topics/api/topicsApi'
import type {Word} from '@/features/words/types/wordTypes'
import type {WordListResponse} from '@/features/words/api/wordsApi'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import type {ReactNode} from 'react'
import {queryKeys} from '@/app/queryKeys'

vi.mock('@/features/words/api/wordsApi')
vi.mock('@/features/topics/api/topicsApi')

const alpha: Word = {
  id: 1, term: 'alpha', topic_ids: [], language: 'en', definition: null,
  pronunciation_ipa: null, pronunciation_audio_url: null, image_url: null, cefr_level: null,
  register: null, frequency_rank: null, verb_form: null, translation_entries: ['first'],
  part_of_speech: 'noun', knowledge_level: 3, countability: null, pattern: null,
  example_entries: [], example_count: 0, example_target_count: 3, example_status: 'missing',
  needs_example_enrichment: true, synonym_entries: [], antonym_entries: [],
  collocation_entries: [], confusable_entries: [], notes: null, is_active: true,
  deleted_at: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
}
const bravo = {...alpha, id: 2, term: 'bravo'}
const page = (words: Word[]): WordListResponse => ({words, total: words.length,
  page: 1, page_size: 20, total_pages: 1})
let queryClient: QueryClient
function Wrapper({children}: {children: ReactNode}) {
  return <QueryClientProvider client={queryClient}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
}

beforeEach(() => {
  vi.resetAllMocks()
  queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}})
  vi.mocked(fetchTopics).mockResolvedValue([])
  vi.mocked(fetchWordList).mockResolvedValue(page([alpha]))
  vi.mocked(fetchWordKnowledgeSummary).mockResolvedValue({total: 1, level_counts: {3: 1}})
})

it('renders word cards at tablet widths where CSS hides the table', async () => {
  const mediaQuery = window.matchMedia('(max-width: 860px)')
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
    ...mediaQuery, media: query, matches: 820 <= Number(query.match(/max-width: ([0-9]+)px/)?.[1] ?? 0),
  }))
  const {container} = render(<AllWordsPage />, {wrapper: Wrapper})
  await waitFor(() => expect(container.querySelector('.word-card .word-term')?.textContent).toBe('alpha'))
})

it('keeps the latest search results when an older request finishes later', async () => {
  let resolveOld!: (value: WordListResponse) => void
  const oldRequest = new Promise<WordListResponse>(resolve => { resolveOld = resolve })
  vi.mocked(fetchWordList).mockImplementation(params => params?.search === 'alpha'
    ? oldRequest : Promise.resolve(page(params?.search === 'bravo' ? [bravo] : [alpha])))
  render(<AllWordsPage />, {wrapper: Wrapper})
  await screen.findByRole('link', {name: 'alpha'})
  fireEvent.click(screen.getAllByRole('button', {name: 'Toggle search'})[0])
  fireEvent.change(screen.getByRole('searchbox', {name: 'Search words'}), {target: {value: 'alpha'}})
  await waitFor(() => expect(fetchWordList).toHaveBeenCalledWith(expect.objectContaining({search: 'alpha'})))
  fireEvent.change(screen.getByRole('searchbox', {name: 'Search words'}), {target: {value: 'bravo'}})
  await screen.findByRole('link', {name: 'bravo'})
  await act(async () => { resolveOld(page([alpha])); await oldRequest })
  expect(screen.getByRole('link', {name: 'bravo'})).toBeTruthy()
  expect(screen.queryByRole('link', {name: 'alpha'})).toBeNull()
})

it('shows a load error instead of presenting a failed search as an empty library', async () => {
  vi.mocked(fetchWordList).mockRejectedValue(new Error('Network down'))
  render(<AllWordsPage />, {wrapper: Wrapper})
  expect((await screen.findByRole('alert')).textContent).toContain('Failed to load words')
  expect(screen.queryByText('No words yet')).toBeNull()
})

it('reports a failed level update and preserves the previous word level', async () => {
  vi.mocked(batchUpdateWords).mockRejectedValue(new Error('Network down'))
  render(<AllWordsPage />, {wrapper: Wrapper})
  await screen.findByRole('link', {name: 'alpha'})
  fireEvent.click(screen.getByRole('button', {name: 'Okay'}))
  fireEvent.click(screen.getByRole('button', {name: 'Strong'}))
  expect((await screen.findByRole('alert')).textContent).toContain('Failed to update word')
  expect(screen.getByRole('button', {name: 'Okay'})).toBeTruthy()
})

it('refreshes other views after a successful level update', async () => {
  vi.mocked(batchUpdateWords).mockResolvedValue({updated: 1})
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  render(<AllWordsPage />, {wrapper: Wrapper})
  await screen.findByRole('link', {name: 'alpha'})
  fireEvent.click(screen.getByRole('button', {name: 'Okay'}))
  fireEvent.click(screen.getByRole('button', {name: 'Strong'}))
  await waitFor(() => {
    expect(invalidate).toHaveBeenCalledWith({queryKey: queryKeys.words})
    expect(invalidate).toHaveBeenCalledWith({queryKey: queryKeys.smartReview})
    expect(invalidate).toHaveBeenCalledWith({queryKey: queryKeys.word(1)})
    expect(invalidate).toHaveBeenCalledWith({queryKey: queryKeys.wordList, refetchType: 'none'})
  })
})

it('keeps selected words when another word rating changes', async () => {
  vi.mocked(fetchWordList).mockResolvedValue(page([alpha, bravo]))
  vi.mocked(batchUpdateWords).mockResolvedValue({updated: 1})
  render(<AllWordsPage />, {wrapper: Wrapper})
  fireEvent.click(await screen.findByRole('checkbox', {name: 'Select alpha'}))
  const row = screen.getByRole('link', {name: 'bravo'}).closest('tr')!
  fireEvent.click(within(row).getByRole('button', {name: 'Okay'}))
  fireEvent.click(screen.getByRole('button', {name: 'Strong'}))
  await waitFor(() => expect(within(row).getByRole('button', {name: 'Strong'})).toBeTruthy())
  expect((screen.getByRole('checkbox', {name: 'Select alpha'}) as HTMLInputElement).checked).toBe(true)
  expect(screen.getByText('1 selected')).toBeTruthy()
})

it.each([false, true])('keeps each word locked until its own rating save finishes (mobile=%s)', async mobile => {
  if (mobile) {
    const original = window.matchMedia('(max-width: 860px)')
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({...original, media: query, matches: true}))
  }
  vi.mocked(fetchWordList).mockResolvedValue(page([alpha, bravo]))
  let finishAlpha!: (value: {updated: number}) => void
  let finishBravo!: (value: {updated: number}) => void
  vi.mocked(batchUpdateWords).mockImplementation(payload => new Promise(resolve => {
    if (payload.word_ids[0] === alpha.id) finishAlpha = resolve
    else finishBravo = resolve
  }))
  const {container} = render(<AllWordsPage />, {wrapper: Wrapper})
  const selector = mobile ? '.word-card' : 'tr.word-row'
  await waitFor(() => expect(container.querySelectorAll(selector).length).toBe(2))
  const rows = Array.from(container.querySelectorAll<HTMLElement>(selector))
  for (const row of rows) {
    fireEvent.click(within(row).getByRole('button', {name: 'Okay'}))
    fireEvent.click(screen.getByRole('button', {name: 'Strong'}))
  }
  expect((within(rows[0]).getByRole('button', {name: 'Okay'}) as HTMLButtonElement).disabled).toBe(true)
  await act(async () => { finishBravo({updated: 1}) })
  expect((within(rows[0]).getByRole('button', {name: 'Okay'}) as HTMLButtonElement).disabled).toBe(true)
  expect((within(rows[1]).getByRole('button', {name: 'Strong'}) as HTMLButtonElement).disabled).toBe(false)
  fireEvent.click(within(rows[0]).getByRole('button', {name: 'Okay'}))
  expect(screen.queryByRole('group', {name: 'Knowledge level'})).toBeNull()
  expect(batchUpdateWords).toHaveBeenCalledTimes(2)
  await act(async () => { finishAlpha({updated: 1}) })
  expect((within(rows[0]).getByRole('button', {name: 'Strong'}) as HTMLButtonElement).disabled).toBe(false)
})

it('prevents individual rating saves while a bulk update is pending', async () => {
  let finish!: (value: {updated: number}) => void
  vi.mocked(batchUpdateWords).mockImplementation(() => new Promise(resolve => { finish = resolve }))
  render(<AllWordsPage />, {wrapper: Wrapper})
  fireEvent.click(await screen.findByRole('checkbox', {name: 'Select alpha'}))
  fireEvent.change(screen.getByRole('combobox', {name: 'Set level'}), {target: {value: '4'}})
  fireEvent.click(screen.getByRole('button', {name: 'Apply'}))
  expect((screen.getByRole('button', {name: 'Okay'}) as HTMLButtonElement).disabled).toBe(true)
  await act(async () => { finish({updated: 1}) })
  expect((screen.getByRole('button', {name: 'Strong'}) as HTMLButtonElement).disabled).toBe(false)
})
