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
