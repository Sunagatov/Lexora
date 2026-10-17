import {fireEvent, render, screen} from '@testing-library/react'
import {MemoryRouter} from 'react-router-dom'
import {WordCollectionView} from '../components/WordCollectionView'

vi.mock('../components/WordCollectionToolbar', () => ({WordCollectionToolbar: () => <div>Toolbar</div>}))

it('returns to the beginning when changing page size, including cached pages', () => {
  const setPage = vi.fn(), setPageSize = vi.fn(), change = vi.fn()
  const {container} = render(<MemoryRouter><WordCollectionView
    wordSearch="" setWordSearch={change} sortBy="level-asc" setSortBy={change}
    levelFilter="all" setLevelFilter={change} posFilter={null} setPosFilter={change}
    cefrFilter={null} setCefrFilter={change} completeness="all" setCompleteness={change} onReset={change}
    totalWordsOverall={200} topicTotalCount={200} filteredCount={200} pageStart={101} pageEnd={150}
    levelSummary={{1: 200, 3: 0, 4: 0, 5: 0}} pageWords={[]}
    page={3} totalPages={4} pageSize={50} setPage={setPage} setPageSize={setPageSize}
    pendingWordId={null} onUpdate={change}
  /></MemoryRouter>)
  const list = container.querySelector('.word-collection-scroll') as HTMLElement
  list.scrollTop = 1200
  list.scrollTo = vi.fn((options?: ScrollToOptions | number, y?: number) => { list.scrollTop = typeof options === 'number' ? y ?? 0 : options?.top ?? 0 })
  fireEvent.change(screen.getAllByRole('combobox', {name: 'Words per page'})[0], {target: {value: '100'}})
  expect(setPageSize).toHaveBeenCalledWith(100)
  expect(list.scrollTop).toBe(0)
})
