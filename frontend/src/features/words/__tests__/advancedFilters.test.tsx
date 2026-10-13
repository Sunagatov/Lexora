import {act, fireEvent, render, screen} from '@testing-library/react'
import {createMemoryRouter, MemoryRouter, RouterProvider, useLocation} from 'react-router-dom'
import {WordCollectionToolbar} from '@/features/words/components/WordCollectionToolbar'
import {useWordFilterControls} from '@/features/words/hooks/useWordFilterControls'
import {fetchWordList} from '@/features/words/api/wordsApi'
import type {Topic} from '@/features/topics/types/topicTypes'

const topics = [{id: 1, name: 'Everyday life', slug: 'everyday-life'} as Topic]
function Probe() {
  const s = useWordFilterControls({defaultPageSize: 50})
  const location = useLocation()
  return <>
    <span data-testid="url">{location.search}</span>
    <WordCollectionToolbar {...s} topics={topics} onLearningSort={s.setLearningSort} onReset={s.resetFilters}
      totalWordsOverall={100} topicTotalCount={100} filteredCount={30} pageStart={1} pageEnd={30}
      levelSummary={{1: 50, 2: 20, 3: 15, 4: 10, 5: 5}} />
  </>
}
const params = () => new URLSearchParams(screen.getByTestId('url').textContent!)

it('keeps every selection when several controls change before the next render', () => {
  const router = createMemoryRouter([{path: '/', element: <Probe />}])
  render(<RouterProvider router={router} />)
  fireEvent.click(screen.getAllByRole('button', {name: 'Toggle filters'})[0])
  act(() => {
    fireEvent.click(screen.getByRole('button', {name: '1 Weak'}))
    fireEvent.click(screen.getByRole('button', {name: '2 Basic'}))
    fireEvent.click(screen.getByRole('button', {name: 'A1'}))
    fireEvent.click(screen.getByRole('button', {name: 'A2'}))
    fireEvent.change(screen.getByLabelText('Primary sort'), {target: {value: 'cefr-asc'}})
    fireEvent.change(screen.getByLabelText('Secondary sort'), {target: {value: 'level-desc'}})
  })
  expect(params().get('level')).toBe('1,2')
  expect(params().get('cefr')).toBe('A1,A2')
  expect(params().get('sort')).toBe('cefr-asc')
  expect(params().get('thenSort')).toBe('level-desc')
})

it('combines selections, removes individual chips, and changes sorting without losing filters', () => {
  render(<MemoryRouter initialEntries={['/?page=3']}><Probe /></MemoryRouter>)
  fireEvent.click(screen.getAllByRole('button', {name: 'Toggle filters'})[0])
  fireEvent.click(screen.getByRole('button', {name: '1 Weak'}))
  fireEvent.click(screen.getByRole('button', {name: '2 Basic'}))
  fireEvent.click(screen.getByRole('button', {name: 'A1'}))
  fireEvent.click(screen.getByRole('button', {name: 'A2'}))
  expect(params().get('level')).toBe('1,2')
  expect(params().get('cefr')).toBe('A1,A2')
  expect(params().has('page')).toBe(false)
  expect(screen.getByRole('button', {name: '1 Weak'}).getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(screen.getByLabelText('Topic: Everyday life'))
  expect(params().get('topics')).toBe('1')
  fireEvent.change(screen.getByLabelText('Primary sort'), {target: {value: 'cefr-asc'}})
  fireEvent.change(screen.getByLabelText('Secondary sort'), {target: {value: 'level-asc'}})
  expect(params().get('sort')).toBe('cefr-asc')
  expect(params().get('thenSort')).toBe('level-asc')
  fireEvent.click(screen.getByRole('button', {name: 'Remove A1 filter'}))
  expect(params().get('cefr')).toBe('A2')
  expect(params().get('level')).toBe('1,2')
  fireEvent.click(screen.getByRole('button', {name: 'Weak words, easiest first'}))
  expect(params().has('sort')).toBe(false)
  expect(params().has('thenSort')).toBe(false)
  expect(params().get('level')).toBe('1,2')
  expect((screen.getByLabelText('Secondary sort') as HTMLSelectElement).value).toBe('cefr-asc')
  fireEvent.click(screen.getByRole('button', {name: 'Clear all'}))
  expect(params().toString()).toBe('')
})

it('serializes multiple filters and both sort priorities for the server', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({words: [], total: 0, page: 1, page_size: 50, total_pages: 0}))))
  try {
    await fetchWordList({level: [1, 2], cefr: ['A1', 'A2'], pos: ['noun', 'verb'], topicIds: [7, 8], sort: 'level-asc', thenSort: 'cefr-desc', pageSize: 50})
    const url = new URL(String(vi.mocked(fetch).mock.calls[0][0]))
    expect(url.searchParams.getAll('levels')).toEqual(['1', '2'])
    expect(url.searchParams.getAll('cefr_levels')).toEqual(['A1', 'A2'])
    expect(url.searchParams.getAll('positions')).toEqual(['noun', 'verb'])
    expect(url.searchParams.getAll('topic_ids')).toEqual(['7', '8'])
    expect(url.searchParams.get('then_sort')).toBe('cefr-desc')
  } finally { vi.unstubAllGlobals() }
})
