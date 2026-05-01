import {render} from '@testing-library/react'
import {MemoryRouter} from 'react-router-dom'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {WordTable} from '@/features/words/components/WordTable'
import type {Word} from '@/features/words/types/wordTypes'

function makeWord(id: number, term: string, overrides: Partial<Word> = {}): Word {
  return {
    id,
    topic_ids: [],
    term,
    translations: 'translation',
    translation_entries: ['translation'],
    part_of_speech: null,
    knowledge_level: 1,
    countability: null,
    pattern: null,
    example: 'Example sentence.',
    example_entries: ['Example sentence.'],
    example_count: 1,
    example_target_count: 3,
    example_status: 'partial',
    needs_example_enrichment: true,
    notes: null,
    is_active: true,
    past_simple: null,
    past_participle: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('WordTable', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

  beforeEach(() => {
    consoleError.mockClear()
  })

  afterEach(() => {
    consoleError.mockClear()
  })

  it('does not emit React key warnings for mapped rows', () => {
    render(
      <MemoryRouter>
        <WordTable
          words={[makeWord(1, 'alpha'), makeWord(2, 'beta')]}
          pendingWordId={null}
          onUpdate={vi.fn()}
        />
      </MemoryRouter>,
    )

    const warnings = consoleError.mock.calls.flat().map(String)
    expect(warnings.some((entry) => entry.includes('Each child in a list should have a unique'))).toBe(false)
  })
})
