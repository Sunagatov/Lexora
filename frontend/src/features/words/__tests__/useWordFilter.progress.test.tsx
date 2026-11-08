import {act, renderHook} from '@testing-library/react'
import {MemoryRouter} from 'react-router-dom'
import type {ReactNode} from 'react'
import type {Word} from '@/features/words/types/wordTypes'
import {useWordFilter} from '@/features/words/hooks/useWordFilter'

const words = [
  {id: 1, term: 'apple', knowledge_level: 1, cefr_level: 'A1', part_of_speech: 'noun'},
  {id: 2, term: 'ask', knowledge_level: 4, cefr_level: 'A1', part_of_speech: 'verb'},
  {id: 3, term: 'answer', knowledge_level: 3, cefr_level: 'A2', part_of_speech: 'noun'},
  {id: 4, term: 'agree', knowledge_level: 5, cefr_level: 'B1', part_of_speech: 'verb'},
] as Word[]

function wrapper({children}: {children: ReactNode}) {
  return <MemoryRouter>{children}</MemoryRouter>
}

it('summarizes only the A1 words, combines filters, and restores the full summary on reset', () => {
  const {result} = renderHook(() => useWordFilter(words), {wrapper})
  expect(result.current.levelSummary).toEqual({1: 1, 3: 1, 4: 1, 5: 1})
  act(() => result.current.setCefrFilter('A1'))
  expect(result.current.levelSummary).toEqual({1: 1, 3: 0, 4: 1, 5: 0})
  act(() => result.current.setPosFilter('verb'))
  expect(result.current.levelSummary).toEqual({1: 0, 3: 0, 4: 1, 5: 0})
  act(() => result.current.resetFilters())
  expect(result.current.levelSummary).toEqual({1: 1, 3: 1, 4: 1, 5: 1})
})

it('clears progress for no matches instead of leaving the previous distribution', () => {
  const {result} = renderHook(() => useWordFilter(words), {wrapper})
  act(() => result.current.setWordSearch('no matching term'))
  expect(result.current.filteredWords).toEqual([])
  expect(result.current.levelSummary).toEqual({1: 0, 3: 0, 4: 0, 5: 0})
})

it('summarizes the complete filtered collection rather than the current page', () => {
  const manyWords = Array.from({length: 80}, (_, i) => ({...words[i % 2], id: i + 1}))
  const {result} = renderHook(() => useWordFilter(manyWords), {wrapper})
  act(() => result.current.setCefrFilter('A1'))
  expect(result.current.pageWords).toHaveLength(50)
  expect(result.current.levelSummary).toEqual({1: 40, 3: 0, 4: 40, 5: 0})
  act(() => result.current.setPage(2))
  expect(result.current.pageWords).toHaveLength(30)
  expect(result.current.levelSummary).toEqual({1: 40, 3: 0, 4: 40, 5: 0})
})

it('updates the summary while keeping a newly rated word in the stable review list', () => {
  const {result, rerender} = renderHook(({items}) => useWordFilter(items), {wrapper, initialProps: {items: words}})
  act(() => result.current.setLevelFilter(1))
  act(() => result.current.setFrozenIds(result.current.filteredWords.map(word => word.id)))
  rerender({items: words.map(word => word.id === 1 ? {...word, knowledge_level: 4} : word)})
  expect(result.current.filteredWords.map(word => word.id)).toEqual([1])
  expect(result.current.levelSummary).toEqual({1: 0, 3: 0, 4: 1, 5: 0})
})
