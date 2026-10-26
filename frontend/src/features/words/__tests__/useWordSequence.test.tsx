import type {ReactNode} from 'react'
import {act, renderHook, waitFor} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {beforeEach, expect, it, vi} from 'vitest'
import {useWordSequence} from '@/features/words/hooks/useWordSequence'
import {fetchWordList, type WordListResponse} from '@/features/words/api/wordsApi'
import type {WordListContext} from '@/features/words/hooks/useWordListNavigation'
import type {Word} from '@/features/words/types/wordTypes'

vi.mock('@/features/words/api/wordsApi', () => ({fetchWordList: vi.fn()}))
beforeEach(() => vi.mocked(fetchWordList).mockReset())

function page(ids: number[], number: number, total = 3): WordListResponse {
  return {words: ids.map(id => ({id, term: String(id)} as Word)), page: number, page_size: 2, total, total_pages: Math.ceil(total / 2)}
}
function renderSequence(id: number, list?: WordListContext) {
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}})
  const wrapper = ({children}: {children: ReactNode}) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return renderHook(() => useWordSequence(id, list), {wrapper})
}

it('keeps the actual filtered list order rather than sorting a word’s topic', () => {
  const {result} = renderSequence(3, {ids: [11, 3, 25], offset: 50, total: 69})
  expect(result.current.currentIndex).toBe(51)
  expect(result.current.total).toBe(69)
  expect(result.current.previousId).toBe(11)
  expect(result.current.nextId).toBe(25)
  expect(fetchWordList).not.toHaveBeenCalled()
})

it('reaches unseen words across page boundaries using the original ID snapshot', () => {
  const ids = Array.from({length: 51}, (_, index) => index + 1)
  const {result} = renderSequence(50, {ids, offset: 0, total: 51})
  expect(result.current.nextId).toBe(51)
  expect(result.current.previousId).toBe(49)
  expect(result.current.currentIndex).toBe(49)
  expect(fetchWordList).not.toHaveBeenCalled()
})

it('crosses to the next page with the same search, filters and sorting', async () => {
  const query = {page: 1, pageSize: 2, search: 'milk', level: [1], pos: 'noun', cefr: 'A1', sort: 'level-asc' as const, thenSort: 'cefr-asc' as const}
  vi.mocked(fetchWordList).mockResolvedValue(page([3], 2))
  const {result} = renderSequence(2, {ids: [1, 2], offset: 0, total: 3, query})
  await waitFor(() => expect(result.current.nextId).toBe(3))
  expect(fetchWordList).toHaveBeenCalledExactlyOnceWith({...query, page: 2})
  expect(result.current.nextContext).toEqual({ids: [3], offset: 2, total: 3, query: {...query, page: 2}})
  expect(result.current.previousId).toBe(1)
})

it('crosses to the previous page without changing the original list scope', async () => {
  const query = {page: 2, pageSize: 2, topicIds: [7], sort: 'term-desc' as const}
  vi.mocked(fetchWordList).mockResolvedValue(page([1, 2], 1))
  const {result} = renderSequence(3, {ids: [3], offset: 2, total: 3, query})
  await waitFor(() => expect(result.current.previousId).toBe(2))
  expect(fetchWordList).toHaveBeenCalledExactlyOnceWith({...query, page: 1})
  expect(result.current.previousContext?.offset).toBe(0)
  expect(result.current.nextId).toBeUndefined()
})

it('does not request pages outside the start or end of the list', () => {
  const {result} = renderSequence(1, {ids: [1], offset: 0, total: 1, query: {page: 1, pageSize: 2}})
  expect(result.current.previousId).toBeUndefined()
  expect(result.current.nextId).toBeUndefined()
  expect(fetchWordList).not.toHaveBeenCalled()
})

it('keeps the current position available and retries a failed neighbouring page', async () => {
  vi.mocked(fetchWordList).mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce(page([3], 2))
  const {result} = renderSequence(2, {ids: [1, 2], offset: 0, total: 3, query: {page: 1, pageSize: 2}})
  await waitFor(() => expect(result.current.error).toBe(true))
  expect(result.current.currentIndex).toBe(1)
  expect(result.current.previousId).toBe(1)
  act(() => result.current.retry())
  await waitFor(() => expect(result.current.nextId).toBe(3))
  expect(result.current.error).toBe(false)
})

it('leaves direct links without list context to the existing topic navigation', () => {
  const {result} = renderSequence(1)
  expect(result.current.currentIndex).toBe(-1)
  expect(result.current.previousId).toBeUndefined()
  expect(result.current.nextId).toBeUndefined()
  expect(fetchWordList).not.toHaveBeenCalled()
})
