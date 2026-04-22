import {render, screen, waitFor} from '@testing-library/react'
import {MemoryRouter, useLocation} from 'react-router-dom'
import {describe, expect, it} from 'vitest'
import {useWordFilter} from '../useWordFilter'
import type {Word} from '../../../shared/types'

function Probe({words, defaultPageSize}: {words: Word[]; defaultPageSize?: number}) {
  const filter = useWordFilter(words, {defaultPageSize})
  const location = useLocation()
  return (
    <div
      data-testid="search"
      data-search={location.search}
      data-page-size={filter.pageSize}
      data-total-pages={filter.totalPages}
    >
      {location.search}
    </div>
  )
}

describe('useWordFilter URL sync', () => {
  it('clamps an out-of-range page param back into the URL', async () => {
    render(
      <MemoryRouter initialEntries={[{pathname: '/', search: '?page=5'}]}>
        <Probe words={[]} />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('search').getAttribute('data-search')).toBe('')
    })
  })

  it('normalizes an out-of-range page param to the last page', async () => {
    const words = Array.from({length: 45}, (_, index) => ({
      id: index + 1,
      topic_ids: [],
      term: `word-${index + 1}`,
      translations: 'translation',
      translation_entries: ['translation'],
      example: 'Example sentence.',
      example_entries: ['Example sentence.'],
      countability: null,
      part_of_speech: null,
      past_simple: null,
      past_participle: null,
      pattern: null,
      notes: null,
      knowledge_level: 1,
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    })) as Word[]

    render(
      <MemoryRouter initialEntries={[{pathname: '/', search: '?page=10'}]}>
        <Probe words={words} />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('search').getAttribute('data-search')).toBe('?page=9')
    })
  })

  it('supports a smaller route-specific default page size', async () => {
    const words = Array.from({length: 20}, (_, index) => ({
      id: index + 1,
      topic_ids: [],
      term: `word-${index + 1}`,
      translations: 'translation',
      translation_entries: ['translation'],
      example: 'Example sentence.',
      example_entries: ['Example sentence.'],
      countability: null,
      part_of_speech: null,
      past_simple: null,
      past_participle: null,
      pattern: null,
      notes: null,
      knowledge_level: 1,
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    })) as Word[]

    render(
      <MemoryRouter initialEntries={[{pathname: '/', search: ''}]}>
        <Probe words={words} defaultPageSize={5} />
      </MemoryRouter>,
    )

    expect(screen.getByTestId('search').getAttribute('data-page-size')).toBe('5')
    expect(screen.getByTestId('search').getAttribute('data-total-pages')).toBe('4')
  })
})
