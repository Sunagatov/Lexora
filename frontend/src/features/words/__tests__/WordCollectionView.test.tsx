import {fireEvent, render, screen} from '@testing-library/react'
import {MemoryRouter} from 'react-router-dom'
import type {ComponentProps} from 'react'
import {WordCollectionView} from '../components/WordCollectionView'

vi.mock('../components/WordCollectionToolbar', () => ({WordCollectionToolbar: () => <div>Toolbar</div>}))
const change = vi.fn()
const defaults: ComponentProps<typeof WordCollectionView> = {
  wordSearch: '', setWordSearch: change, sortBy: 'level-asc', setSortBy: change,
  levelFilter: 'all', setLevelFilter: change, posFilter: null, setPosFilter: change,
  cefrFilter: null, setCefrFilter: change, completeness: 'all', setCompleteness: change, onReset: change,
  totalWordsOverall: 600, topicTotalCount: 600, filteredCount: 600, pageStart: 101, pageEnd: 150,
  levelSummary: {1: 600, 3: 0, 4: 0, 5: 0}, pageWords: [],
  page: 3, totalPages: 12, pageSize: 50, setPage: change, setPageSize: change,
  pendingWordId: null, onUpdate: change,
}
function view(overrides: Partial<typeof defaults> = {}, scrollTop?: number) {
  return <MemoryRouter initialEntries={[{pathname: '/', state: {wordListScrollTop: scrollTop}}]}>
    <WordCollectionView {...defaults} {...overrides} />
  </MemoryRouter>
}

it.each([50, 100, 200])('resets next/previous cached and delayed pages after rows commit (size=%s)', pageSize => {
  const setPage = vi.fn()
  const {container, rerender} = render(view({pageSize, setPage}))
  const list = container.querySelector('.word-collection-scroll') as HTMLElement
  list.scrollTop = 1200
  fireEvent.click(screen.getByRole('button', {name: 'Next page'}))
  expect(setPage).toHaveBeenCalledWith(4)
  rerender(view({pageSize, page: 4, isLoading: true}))
  // Placeholder rows can still be scrolled/anchored before the response arrives.
  list.scrollTop = 900
  rerender(view({pageSize, page: 4, isLoading: false}))
  expect(list.scrollTop).toBe(0)
  list.scrollTop = 600
  rerender(view({pageSize, page: 3}))
  expect(list.scrollTop).toBe(0)
  list.scrollTop = 400
  rerender(view({pageSize, page: 3}))
  expect(list.scrollTop).toBe(400)
})

it('resets on committed page-size and filter changes, even when page number stays the same', () => {
  const setPageSize = vi.fn()
  const {container, rerender} = render(view({setPageSize}))
  const list = container.querySelector('.word-collection-scroll') as HTMLElement
  list.scrollTop = 1200
  fireEvent.change(screen.getAllByRole('combobox', {name: 'Words per page'})[0], {target: {value: '100'}})
  expect(setPageSize).toHaveBeenCalledWith(100)
  rerender(view({pageSize: 100}))
  expect(list.scrollTop).toBe(0)
  list.scrollTop = 600
  rerender(view({pageSize: 100, wordSearch: 'train'}))
  expect(list.scrollTop).toBe(0)
})

it('restores returning word-list scroll once, after loading, without replaying it on refetch', () => {
  const {container, rerender} = render(view({isLoading: true}, 844))
  const list = container.querySelector('.word-collection-scroll') as HTMLElement
  expect(list.scrollTop).toBe(0)
  rerender(view({isLoading: false}, 844))
  expect(list.scrollTop).toBe(844)
  list.scrollTop = 300
  rerender(view({isLoading: true}, 844))
  rerender(view({isLoading: false}, 844))
  expect(list.scrollTop).toBe(300)
  rerender(view({page: 4}, 844))
  expect(list.scrollTop).toBe(0)
})
