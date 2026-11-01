import {useState} from 'react'
import {fireEvent, render, screen} from '@testing-library/react'
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

  it('stays expanded after blur while a query is present and shrinks after clearing', () => {
    const {container} = render(<Toolbar />)
    const wrapper = container.querySelector('.toolbar-inline-search')
    const input = screen.getByRole('searchbox', {name: 'Search words'}) as HTMLInputElement
    expect(wrapper?.classList.contains('has-query')).toBe(false)

    input.focus()
    fireEvent.change(input, {target: {value: 'привет'}})
    expect(wrapper?.classList.contains('has-query')).toBe(true)

    input.blur()
    expect(input.value).toBe('привет')
    expect(wrapper?.classList.contains('has-query')).toBe(true)

    fireEvent.click(screen.getByRole('button', {name: 'Clear search'}))
    expect(wrapper?.classList.contains('has-query')).toBe(false)
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
})
