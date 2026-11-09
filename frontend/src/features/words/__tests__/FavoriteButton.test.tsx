import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { FavoriteButton } from '@/features/words/components/FavoriteButton'
import { updateWord } from '@/features/words/api/wordsApi'
import type { Word, WordKnowledgeLevel } from '@/features/words/types/wordTypes'
import { queryKeys } from '@/app/queryKeys'

vi.mock('@/features/words/api/wordsApi', () => ({ updateWord: vi.fn() }))
afterEach(() => vi.resetAllMocks())
const word = {
  id: 1,
  term: 'patient',
  language: 'en',
  knowledge_level: 1,
  is_favorite: true,
} as Word

it('unfavorites without removing the visible card or overwriting a newer rating', async () => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const key = [...queryKeys.wordList, { favoritesOnly: true }]
  client.setQueryData(key, { words: [word], total: 1 })
  let complete!: (value: Word) => void
  vi.mocked(updateWord).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve
      }),
  )
  render(
    <QueryClientProvider client={client}>
      <FavoriteButton word={word} />
    </QueryClientProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Remove patient from Favorites' }))
  await waitFor(() => expect(updateWord).toHaveBeenCalledWith(1, { is_favorite: false }))
  client.setQueryData(key, {
    words: [{ ...word, knowledge_level: 4 as WordKnowledgeLevel }],
    total: 1,
  })
  complete({ ...word, is_favorite: false })
  await waitFor(() =>
    expect(client.getQueryData<{ words: Word[] }>(key)?.words[0].is_favorite).toBe(false),
  )
  const saved = client.getQueryData<{ words: Word[] }>(key)!.words
  expect(saved).toHaveLength(1)
  expect(saved[0].knowledge_level).toBe(4)
})

it('shows a failed save and leaves the favorite unchanged', async () => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  vi.mocked(updateWord).mockRejectedValueOnce(new Error('No connection'))
  render(
    <QueryClientProvider client={client}>
      <FavoriteButton word={word} />
    </QueryClientProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Remove patient from Favorites' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Not saved')
  expect(word.is_favorite).toBe(true)
})


it.each([false, true])('immediately reflects a delayed save and deduplicates rapid taps (was favorite=%s)', async wasFavorite => {
  const client = new QueryClient({defaultOptions: {mutations: {retry: false}}})
  let complete!: (value: Word) => void
  vi.mocked(updateWord).mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
  render(<QueryClientProvider client={client}><FavoriteButton word={{...word, is_favorite: wasFavorite}} /></QueryClientProvider>)
  const button = screen.getByRole('button')
  fireEvent.click(button)
  fireEvent.click(button)
  await waitFor(() => expect(updateWord).toHaveBeenCalledTimes(1))
  expect(button.getAttribute('aria-pressed')).toBe(String(!wasFavorite))
  expect(button.getAttribute('aria-busy')).toBe('true')
  complete({...word, is_favorite: !wasFavorite})
  await waitFor(() => expect(button.getAttribute('aria-busy')).toBe('false'))
})

it('shares a per-word save lock across visible controls and preserves a concurrent rating on rollback', async () => {
  const client = new QueryClient({defaultOptions: {mutations: {retry: false}}})
  const key = [...queryKeys.wordList, {page: 1}]
  client.setQueryData(key, {words: [word], total: 1})
  let fail!: (error: Error) => void
  vi.mocked(updateWord).mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject }))
  render(<QueryClientProvider client={client}><FavoriteButton word={word} /><FavoriteButton word={word} /></QueryClientProvider>)
  const buttons = screen.getAllByRole('button')
  fireEvent.click(buttons[0])
  fireEvent.click(buttons[1])
  await waitFor(() => expect(updateWord).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(client.getQueryData<{words: Word[]}>(key)?.words[0].is_favorite).toBe(false))
  for (const button of buttons) {
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect((button as HTMLButtonElement).disabled).toBe(true)
  }
  client.setQueryData(key, {words: [{...word, is_favorite: false, knowledge_level: 5}], total: 1})
  fail(new Error('Save failed'))
  await screen.findByRole('alert')
  expect(client.getQueryData<{words: Word[]}>(key)?.words[0]).toMatchObject({is_favorite: true, knowledge_level: 5})
  expect((buttons[0] as HTMLButtonElement).disabled).toBe(false)
  vi.mocked(updateWord).mockResolvedValueOnce({...word, is_favorite: false})
  fireEvent.click(buttons[0])
  await waitFor(() => expect(updateWord).toHaveBeenCalledTimes(2))
  await waitFor(() => expect(client.getQueryData<{words: Word[]}>(key)?.words[0].is_favorite).toBe(false))
})

it('applies a delayed response to the original word after navigating to another word', async () => {
  const client = new QueryClient({defaultOptions: {mutations: {retry: false}}})
  const other = {...word, id: 2, term: 'another', is_favorite: true}
  const key = [...queryKeys.wordList, {page: 1}]
  client.setQueryData(key, {words: [word, other], total: 2})
  let complete!: (value: Word) => void
  vi.mocked(updateWord).mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
  const view = (value: Word) => <QueryClientProvider client={client}><FavoriteButton word={value} /></QueryClientProvider>
  const {rerender} = render(view(word))
  fireEvent.click(screen.getByRole('button'))
  await waitFor(() => expect(updateWord).toHaveBeenCalledOnce())
  rerender(view(other))
  complete({...word, is_favorite: false})
  await waitFor(() => expect(client.isMutating()).toBe(0))
  expect(client.getQueryData<{words: Word[]}>(key)?.words.map(w => w.is_favorite)).toEqual([false, true])
})
