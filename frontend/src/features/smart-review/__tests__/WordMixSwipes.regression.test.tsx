import {act, fireEvent, render, waitFor} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {MemoryRouter} from 'react-router-dom'
import {expect, it, vi} from 'vitest'
import {SmartReviewView} from '../components/SmartReviewView'
import {useSmartReview} from '../hooks/useSmartReview'
import {useWordUpdate} from '@/features/words/hooks/useWordUpdate'
import type {StudyQueue} from '../types/studyQueueTypes'

vi.mock('../hooks/useSmartReview')
vi.mock('@/features/words/hooks/useWordUpdate')
vi.mock('@/shared/hooks/useIsMobile', () => ({useIsMobile: () => true}))

it.each([1, 4])('completes a Daily Mix item after a Strong swipe from level %s', async knowledge_level => {
  const completeItem = vi.fn()
  const updateLevelAsync = vi.fn().mockResolvedValue({})
  vi.mocked(useSmartReview).mockReturnValue({completeItem, refresh: vi.fn(), isRefreshing: false} as never)
  vi.mocked(useWordUpdate).mockReturnValue({updateLevelAsync, pendingWordId: null, pendingWordIds: new Set()} as never)
  const queue = {id: 1, generated_at: '2026-11-08T12:00:00Z', expires_at: '2026-11-09T12:00:00Z',
    total_count: 1, completed_count: 0, is_active: true,
    items: [{id: 101, word_id: 1, position: 0, is_completed: false, completed_at: null,
      word: {id: 1, term: 'hello', language: 'en', knowledge_level, topic_ids: [1],
        translation_entries: ['привет'], example_entries: [], synonym_entries: [], antonym_entries: [],
        collocation_entries: [], part_of_speech: 'noun', created_at: '', updated_at: ''}}]} as unknown as StudyQueue
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}})
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/smart-review']}>
    <SmartReviewView queue={queue} isLoading={false} />
  </MemoryRouter></QueryClientProvider>)
  const card = document.querySelector('article')!
  card.setPointerCapture = vi.fn()
  await act(async () => {
    for (const [type, clientX] of [['pointerdown', 100], ['pointermove', 195], ['pointerup', 195]] as const) {
      const event = new Event(type, {bubbles: true})
      Object.assign(event, {pointerType: 'touch', pointerId: 1, isPrimary: true, clientX, clientY: 100})
      fireEvent(card, event)
    }
  })
  await waitFor(() => expect(completeItem).toHaveBeenCalledWith(101))
})
