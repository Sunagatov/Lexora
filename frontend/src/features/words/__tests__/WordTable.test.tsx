import {render, screen} from '@testing-library/react'
import {MemoryRouter} from 'react-router-dom'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {WordTable} from '@/features/words/components/WordTable'
import type {Word} from '@/features/words/types/wordTypes'

function makeWord(id: number, term: string, overrides: Partial<Word> = {}): Word {
  return {
    id,
    topic_ids: [],
    term,
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
    part_of_speech: null,
    knowledge_level: 1,
    countability: null,
    pattern: null,
    example_entries: ['Example sentence.'],
    example_count: 1,
    example_target_count: 3,
    example_status: 'partial',
    needs_example_enrichment: true,
    synonym_entries: [],
    antonym_entries: [],
    collocation_entries: [],
    confusable_entries: [],
    notes: null,
    is_active: true,
    deleted_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('WordTable', () => {
  it('puts Russian reading hints in their own second column', () => {
    const {container} = render(<MemoryRouter><WordTable words={[makeWord(1, 'hola', {
      language: 'es', pronunciation_easy: 'о́ла', pronunciation_note_ru: 'Приблизительно',
    })]} pendingWordId={null} onUpdate={vi.fn()} /></MemoryRouter>)
    const row = container.querySelector('.word-row')!
    expect(row.children).toHaveLength(4)
    expect(row.children[1].textContent).toBe('о́ла')
    expect(screen.getByTitle('Приблизительно').getAttribute('lang')).toBe('ru')
  })

  it('shows every saved translation in the desktop word list', () => {
    const translations = ['холодный', 'прохладный', 'остывший', 'неприветливый']
    render(
      <MemoryRouter>
        <WordTable words={[makeWord(1, 'cold', {translation_entries: translations})]} pendingWordId={null} onUpdate={vi.fn()} />
      </MemoryRouter>,
    )

    expect(screen.getByText(translations.join(' · '))).toBeTruthy()
  })

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
