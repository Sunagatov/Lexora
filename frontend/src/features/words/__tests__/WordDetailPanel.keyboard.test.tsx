import {fireEvent, render, screen, waitFor} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {MemoryRouter} from 'react-router-dom'
import {WordDetailPanel} from '@/features/words/components/WordDetailPanel'
import {WordCollectionToolbar} from '@/features/words/components/WordCollectionToolbar'
import type {Word} from '@/features/words/types/wordTypes'
import * as api from '@/features/words/api/wordsApi'
import * as topicsApi from '@/features/topics/api/topicsApi'

vi.mock('@/features/words/api/wordsApi')
vi.mock('@/features/topics/api/topicsApi')

const first: Word = {
  id: 1, term: 'apple', translation_entries: ['яблоко'], topic_ids: [], language: 'en',
  definition: null, pronunciation_ipa: null, pronunciation_audio_url: null, image_url: null,
  part_of_speech: 'noun', cefr_level: 'A1', register: null, countability: null,
  frequency_rank: null, knowledge_level: 1, pattern: null, notes: null, is_active: true,
  verb_form: null, example_entries: [], example_count: 0, example_target_count: 3,
  example_status: 'missing', needs_example_enrichment: true, synonym_entries: [],
  antonym_entries: [], collocation_entries: [], confusable_entries: [], deleted_at: null,
  created_at: '2026-10-14T00:00:00Z', updated_at: '2026-10-14T00:00:00Z',
}
const second = {...first, id: 2, term: 'bread'}

function setup() {
  vi.mocked(api.fetchWord).mockResolvedValue(first)
  vi.mocked(topicsApi.fetchTopics).mockResolvedValue([])
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}})
  const onNavigate = vi.fn()
  const onClose = vi.fn()
  render(<QueryClientProvider client={client}><MemoryRouter>
    <WordCollectionToolbar
      wordSearch="" setWordSearch={vi.fn()} sortBy="level-asc" setSortBy={vi.fn()}
      levelFilter="all" setLevelFilter={vi.fn()} posFilter={null} setPosFilter={vi.fn()}
      cefrFilter={null} setCefrFilter={vi.fn()} completeness="all" setCompleteness={vi.fn()}
      onReset={vi.fn()} totalWordsOverall={2} topicTotalCount={2} filteredCount={2}
      pageStart={1} pageEnd={2} levelSummary={{1: 2, 2: 0, 3: 0, 4: 0, 5: 0}}
    />
    <WordDetailPanel wordId={1} words={[first, second]} onClose={onClose} onNavigate={onNavigate} />
    <textarea aria-label="Notes" />
    <select aria-label="Test selection"><option>First</option><option>Second</option></select>
    <div contentEditable aria-label="Editable text" />
  </MemoryRouter></QueryClientProvider>)
  return {onNavigate, onClose}
}

it('uses arrows for word navigation only when the user is not editing a field', async () => {
  const {onNavigate} = setup()
  await screen.findByRole('heading', {name: 'apple'})
  fireEvent.click(screen.getByRole('button', {name: 'Toggle search'}))
  for (const field of [screen.getByRole('searchbox'), screen.getByRole('textbox', {name: 'Notes'}),
    screen.getByRole('combobox', {name: 'Test selection'}), screen.getByLabelText('Editable text')]) {
    fireEvent.keyDown(field, {key: 'ArrowRight'})
  }
  expect(onNavigate).not.toHaveBeenCalled()
  fireEvent.keyDown(document.body, {key: 'ArrowRight', ctrlKey: true})
  expect(onNavigate).not.toHaveBeenCalled()
  fireEvent.keyDown(document.body, {key: 'ArrowRight'})
  expect(onNavigate).toHaveBeenCalledWith(2)
})

it('shows failed detail requests with a working Retry action', async () => {
  vi.mocked(api.fetchWord).mockRejectedValueOnce(new Error('Network down'))
  setup()
  expect((await screen.findByRole('alert')).textContent).toContain('Failed to load word details')
  expect(screen.queryByText('Word not found.')).toBeNull()
  fireEvent.click(screen.getByRole('button', {name: 'Retry'}))
  await screen.findByRole('heading', {name: 'apple'})
  expect(screen.queryByRole('alert')).toBeNull()
})

it('Escape closes the active toolbar layer before the word detail panel', async () => {
  const {onClose} = setup()
  await screen.findByRole('heading', {name: 'apple'})
  fireEvent.click(screen.getByRole('button', {name: 'Toggle filters'}))
  fireEvent.keyDown(document.body, {key: 'Escape'})
  expect(screen.queryByText('Filters & sorting')).toBeNull()
  await new Promise(resolve => setTimeout(resolve, 300))
  expect(onClose).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', {name: 'Toggle search'}))
  fireEvent.keyDown(screen.getByRole('searchbox'), {key: 'Escape'})
  expect(screen.queryByRole('searchbox')).toBeNull()
  await new Promise(resolve => setTimeout(resolve, 300))
  expect(onClose).not.toHaveBeenCalled()
  fireEvent.keyDown(document.body, {key: 'Escape'})
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
})
