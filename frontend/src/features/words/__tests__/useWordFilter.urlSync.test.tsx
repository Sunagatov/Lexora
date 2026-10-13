import {act, render, screen, waitFor} from '@testing-library/react'
import {MemoryRouter, useLocation} from 'react-router-dom'
import {describe, expect, it} from 'vitest'
import {useWordFilter} from '@/features/words/hooks/useWordFilter'
import type {Word} from '@/features/words/types/wordTypes'

function Probe({words, defaultPageSize, isLoading}: {words: Word[]; defaultPageSize?: number; isLoading?: boolean}) {
  const filter = useWordFilter(words, {defaultPageSize, isLoading})
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
  it('keeps the saved page while a list is loading from a cold cache', async () => {
    const {rerender} = render(<MemoryRouter initialEntries={['/topics/test?page=3']}>
      <Probe words={[]} isLoading />
    </MemoryRouter>)
    await act(async () => {})
    expect(screen.getByTestId('search').getAttribute('data-search')).toBe('?page=3')
    const words = Array.from({length: 60}, (_, index) => ({id: index + 1, term: `word-${index}`, knowledge_level: 1} as Word))
    rerender(<MemoryRouter initialEntries={['/topics/test?page=3']}>
      <Probe words={words} isLoading={false} defaultPageSize={20} />
    </MemoryRouter>)
    await waitFor(() => expect(screen.getByTestId('search').getAttribute('data-search')).toBe('?page=3'))
    expect(screen.getByTestId('search').getAttribute('data-total-pages')).toBe('3')
  })

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
      language: 'en',
      definition: null,
      pronunciation_ipa: null,
      pronunciation_audio_url: null,
      image_url: null,
      cefr_level: null,
      register: null,
      frequency_rank: null,
      verb_form: null,
      translation_entries: ['translation'],
      example_entries: ['Example sentence.'],
      countability: null,
      part_of_speech: null,
      pattern: null,
      notes: null,
      knowledge_level: 1,
      is_active: true,
      example_count: 1,
      example_target_count: 3,
      example_status: 'partial' as const,
      needs_example_enrichment: false,
      synonym_entries: [],
      antonym_entries: [],
      collocation_entries: [],
      confusable_entries: [],
      deleted_at: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    })) as Word[]

    render(
      <MemoryRouter initialEntries={[{pathname: '/', search: '?page=10'}]}>
        <Probe words={words} />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('search').getAttribute('data-search')).toBe('?page=3')
    })
  })

  it('supports a route-specific default page size', async () => {
    const words = Array.from({length: 80}, (_, index) => ({
      id: index + 1,
      topic_ids: [],
      term: `word-${index + 1}`,
      language: 'en',
      definition: null,
      pronunciation_ipa: null,
      pronunciation_audio_url: null,
      image_url: null,
      cefr_level: null,
      register: null,
      frequency_rank: null,
      verb_form: null,
      translation_entries: ['translation'],
      example_entries: ['Example sentence.'],
      countability: null,
      part_of_speech: null,
      pattern: null,
      notes: null,
      knowledge_level: 1,
      is_active: true,
      example_count: 1,
      example_target_count: 3,
      example_status: 'partial' as const,
      needs_example_enrichment: false,
      synonym_entries: [],
      antonym_entries: [],
      collocation_entries: [],
      confusable_entries: [],
      deleted_at: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    })) as Word[]

    render(
      <MemoryRouter initialEntries={[{pathname: '/', search: ''}]}>
        <Probe words={words} defaultPageSize={40} />
      </MemoryRouter>,
    )

    expect(screen.getByTestId('search').getAttribute('data-page-size')).toBe('40')
    expect(screen.getByTestId('search').getAttribute('data-total-pages')).toBe('2')
  })
})
