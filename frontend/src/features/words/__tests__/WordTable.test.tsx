import {act, fireEvent, render as testingRender, screen, within} from '@testing-library/react'
import type {ReactElement} from 'react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {MemoryRouter} from 'react-router-dom'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {WordTable} from '@/features/words/components/WordTable'
import type {Word} from '@/features/words/types/wordTypes'
import {setPronunciationPreferences} from '@/features/languages/pronunciationPreferences'

function render(element: ReactElement) {
  return testingRender(<QueryClientProvider client={new QueryClient()}>{element}</QueryClientProvider>)
}

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
  it('moves pronunciation below the term in a narrow panel without leaving an extra table column', () => {
    let resize!: (width: number) => void
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: (entries: {contentRect: {width: number}}[]) => void) {
        resize = width => callback([{contentRect: {width}}])
      }
      observe() {}
      disconnect() {}
    })
    try {
      const {container} = render(<MemoryRouter><WordTable words={[makeWord(1, 'hola', {language: 'es', pronunciation_easy: 'о́ла'})]} pendingWordId={null} onUpdate={vi.fn()} /></MemoryRouter>)
      act(() => resize(600))
      expect(screen.getAllByRole('columnheader')).toHaveLength(3)
      expect(container.querySelector('.word-inline-pronunciation')?.textContent).toBe('о́ла')
      act(() => resize(1200))
      expect(screen.getAllByRole('columnheader')).toHaveLength(4)
      expect(container.querySelector('td.word-cell-pronunciation')?.textContent).toBe('о́ла')
    } finally { vi.unstubAllGlobals() }
  })
  it('opens word details from the term without expanding an inline row or changing its rating', () => {
    const select = vi.fn()
    const update = vi.fn()
    render(<MemoryRouter><WordTable words={[makeWord(1, 'hello', {example_entries: ['Example sentence.', 'Another example.']})]} pendingWordId={null} onUpdate={update} onWordSelect={select} /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', {name: 'hello'}))
    expect(select).toHaveBeenCalledExactlyOnceWith(1)
    expect(update).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', {name: /Expand details|Collapse details/})).toBeNull()
  })
  it('switches the pronunciation column without replacing words or changing ratings', () => {
    const word = makeWord(1, '你好', {language: 'zh', pronunciation_easy: 'ни³ хао³', transliteration: 'nǐ hǎo', pronunciation_ipa: 'ni xau'})
    const update = vi.fn()
    const {container} = render(<MemoryRouter><WordTable words={[word]} pendingWordId={null} onUpdate={update} /></MemoryRouter>)
    const originalRow = container.querySelector('.word-row')
    expect(container.querySelector('td.word-cell-pronunciation')?.textContent).toBe('ни³ хао³')
    act(() => setPronunciationPreferences({zh: 'pinyin'}))
    expect(container.querySelector('td.word-cell-pronunciation')?.textContent).toBe('nǐ hǎo')
    expect(within(document.querySelector('td.word-cell-pronunciation') as HTMLElement).getByTitle('Pinyin with tone marks').getAttribute('lang')).toBe('zh-Latn')
    act(() => setPronunciationPreferences({zh: 'ipa'}))
    expect(container.querySelector('td.word-cell-pronunciation')?.textContent).toBe('ni xau')
    expect(container.querySelector('.word-row')).toBe(originalRow)
    expect(word.knowledge_level).toBe(1)
    expect(update).not.toHaveBeenCalled()
    act(() => setPronunciationPreferences({}))
  })

  it('puts Russian reading hints in their own second column', () => {
    const {container} = render(<MemoryRouter><WordTable words={[makeWord(1, 'hola', {
      language: 'es', pronunciation_easy: 'о́ла', pronunciation_note_ru: 'Приблизительно',
    })]} pendingWordId={null} onUpdate={vi.fn()} /></MemoryRouter>)
    const row = container.querySelector('.word-row')!
    expect(row.children).toHaveLength(4)
    expect(row.children[1].textContent).toBe('о́ла')
    expect(within(row.children[1] as HTMLElement).getByTitle('Приблизительно').getAttribute('lang')).toBe('ru')
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
