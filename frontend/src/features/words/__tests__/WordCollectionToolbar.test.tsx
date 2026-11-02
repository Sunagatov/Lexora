import {useState} from 'react'
import {act, fireEvent, render, screen} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'
import {WordCollectionToolbar} from '../components/WordCollectionToolbar'

function Toolbar() {
  const [search, setSearch] = useState('')
  const change = vi.fn()
  return <WordCollectionToolbar
    wordSearch={search} setWordSearch={setSearch} sortBy="level-asc" setSortBy={change}
    levelFilter="all" setLevelFilter={change} posFilter={null} setPosFilter={change}
    cefrFilter={null} setCefrFilter={change} completeness="all" setCompleteness={change}
    onReset={change} totalWordsOverall={100} topicTotalCount={100} filteredCount={100}
    pageStart={1} pageEnd={50} levelSummary={{1: 100, 3: 0, 4: 0, 5: 0}}
  />
}

describe('permanent vocabulary search', () => {
  it('shows search immediately without stealing focus or requiring a toggle', () => {
    render(<Toolbar />)
    const input = screen.getByRole('searchbox', {name: 'Search words'})
    expect(input).toBeTruthy()
    expect(document.activeElement).not.toBe(input)
    expect(screen.queryByRole('button', {name: 'Toggle search'})).toBeNull()
  })

  it('keeps the query after focus leaves the search field', () => {
    render(<Toolbar />)
    const input = screen.getByRole('searchbox', {name: 'Search words'}) as HTMLInputElement

    act(() => input.focus())
    fireEvent.change(input, {target: {value: 'привет'}})

    act(() => input.blur())
    expect(input.value).toBe('привет')

    fireEvent.click(screen.getByRole('button', {name: 'Clear search'}))
    expect(input.value).toBe('')
    expect(document.activeElement).toBe(input)
  })

  it('clears the query and returns focus to the input', () => {
    render(<Toolbar />)
    const input = screen.getByRole('searchbox', {name: 'Search words'}) as HTMLInputElement
    fireEvent.change(input, {target: {value: 'привет'}})
    expect(input.value).toBe('привет')
    fireEvent.click(screen.getByRole('button', {name: 'Clear search'}))
    expect(input.value).toBe('')
    expect(document.activeElement).toBe(input)
    expect(screen.queryByRole('button', {name: 'Clear search'})).toBeNull()
  })

  it('exits expanded search with Done or Escape without losing the query', () => {
    render(<Toolbar />)
    const input = screen.getByRole('searchbox', {name: 'Search words'}) as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, {target: {value: 'hola'}})
    fireEvent.click(screen.getByRole('button', {name: 'Done'}))
    expect(input.value).toBe('hola')
    expect(screen.queryByRole('button', {name: 'Done'})).toBeNull()
    fireEvent.focus(input)
    fireEvent.keyDown(input, {key: 'Escape'})
    expect(input.value).toBe('hola')
    expect(screen.queryByRole('button', {name: 'Done'})).toBeNull()
  })

  it('keeps the query visible when Escape dismisses sorting', () => {
    render(<Toolbar />)
    const input = screen.getByRole('searchbox', {name: 'Search words'}) as HTMLInputElement
    fireEvent.change(input, {target: {value: 'hello'}})
    fireEvent.click(screen.getByRole('button', {name: 'Sort words'}))
    expect(screen.getByRole('listbox', {name: 'Sort options'})).toBeTruthy()
    fireEvent.keyDown(document.body, {key: 'Escape'})
    expect(screen.queryByRole('listbox', {name: 'Sort options'})).toBeNull()
    expect(input.value).toBe('hello')
  })

  it.each([20, 200])('measures filtered progress independently of a list response containing %s words', (listCount) => {
    const change = vi.fn()
    render(<WordCollectionToolbar
      wordSearch="" setWordSearch={change} sortBy="level-asc" setSortBy={change}
      levelFilter="all" setLevelFilter={change} posFilter={null} setPosFilter={change}
      cefrFilter="A1" setCefrFilter={change} completeness="all" setCompleteness={change}
      onReset={change} totalWordsOverall={1000} topicTotalCount={1000} filteredCount={listCount}
      pageStart={1} pageEnd={20} levelSummary={{1: 10, 3: 0, 4: 10, 5: 0}}
      progressLabel="Filtered vocabulary progress"
      progressCount={20}
    />)
    const progress = screen.getByRole('progressbar', {name: 'Filtered vocabulary progress'})
    expect(progress.getAttribute('aria-valuenow')).toBe('50')
    expect(progress.getAttribute('aria-valuetext')).toBe('50.00% strong')
  })

  it('shows only the matching count and calculates percentages from that filtered scope', () => {
    const change = vi.fn()
    render(<WordCollectionToolbar
      wordSearch="" setWordSearch={change} sortBy="level-asc" setSortBy={change}
      levelFilter="all" setLevelFilter={change} posFilter={null} setPosFilter={change}
      cefrFilter="A1" setCefrFilter={change} completeness="all" setCompleteness={change}
      onReset={change} totalWordsOverall={7354} topicTotalCount={7354} filteredCount={850}
      pageStart={1} pageEnd={50} levelSummary={{1: 680, 3: 0, 4: 170, 5: 0}}
      progressCount={850}
    />)
    expect(screen.getByLabelText('850 matching words').textContent).toBe('· 850')
    expect(screen.queryByText(/7,354/)).toBeNull()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe('20.00% strong')
    expect(screen.getByText('80.00%')).toBeTruthy()
  })
})
