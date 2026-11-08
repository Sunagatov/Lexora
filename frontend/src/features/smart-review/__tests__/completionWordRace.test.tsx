import {act, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {expect, it, vi} from 'vitest'
import {useSmartReview} from '../hooks/useSmartReview'
import {completeSmartReviewItem} from '../api/smartReviewApi'
import {FavoriteButton} from '@/features/words/components/FavoriteButton'
import {updateWord} from '@/features/words/api/wordsApi'
import {queryKeys} from '@/app/queryKeys'
import type {StudyQueue} from '../types/studyQueueTypes'

vi.mock('../api/smartReviewApi', () => ({fetchSmartReview: vi.fn(), completeSmartReviewItem: vi.fn(), refreshSmartReview: vi.fn()}))
vi.mock('@/features/words/api/wordsApi', () => ({updateWord: vi.fn()}))

function Review() {
  const review = useSmartReview(false)
  return <><button onClick={() => review.completeItem(101)}>Complete review</button>
    <FavoriteButton word={review.queue!.items[0].word} /></>
}

it.each([false, true])('keeps a newer Favorite change when completion arrives late: %s', async concurrentFavorite => {
  const queue = {id: 1, generated_at: '', expires_at: '', is_active: true, completed_count: 0, total_count: 1,
    items: [{id: 101, word_id: 1, position: 0, is_completed: false, completed_at: null,
      word: {id: 1, term: 'hello', language: 'en', is_favorite: false, knowledge_level: 1}}]} as unknown as StudyQueue
  let finishCompletion!: (queue: StudyQueue) => void
  vi.mocked(completeSmartReviewItem).mockReset().mockImplementation(() => new Promise(resolve => {finishCompletion = resolve}))
  vi.mocked(updateWord).mockResolvedValue({...queue.items[0].word, is_favorite: true})
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}})
  client.setQueryData(queryKeys.smartReview, queue)
  render(<QueryClientProvider client={client}><Review /></QueryClientProvider>)
  fireEvent.click(screen.getByRole('button', {name: 'Complete review'}))
  await waitFor(() => expect(finishCompletion).toBeDefined())
  if (concurrentFavorite) {
    fireEvent.click(screen.getByRole('button', {name: 'Add hello to Favorites'}))
    await screen.findByRole('button', {name: 'Remove hello from Favorites'})
  }
  await act(async () => finishCompletion({...queue, completed_count: 1,
    items: [{...queue.items[0], is_completed: true, completed_at: '2026-11-08T12:00:00Z'}]}))
  await waitFor(() => expect(client.getQueryData<StudyQueue>(queryKeys.smartReview)?.completed_count).toBe(1))
  expect(client.getQueryData<StudyQueue>(queryKeys.smartReview)?.items[0].word.is_favorite).toBe(concurrentFavorite)
})
