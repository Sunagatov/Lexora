import {fireEvent, render, screen} from '@testing-library/react'
import {createMemoryRouter, RouterProvider} from 'react-router-dom'
import {describe, expect, it, vi} from 'vitest'
import {WordCardList} from '@/features/words/components/WordCardList'
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
    knowledge_level: 2,
    countability: null,
    pattern: null,
    example_entries: [],
    example_count: 0,
    example_target_count: 3,
    example_status: 'missing',
    needs_example_enrichment: false,
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

describe('WordCardList', () => {
  it('closes the level dropdown without navigating to the word page', () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: (
            <WordCardList
              words={[makeWord(1, 'alpha')]}
              pendingWordId={null}
              onUpdate={vi.fn()}
            />
          ),
        },
        {path: '/words/:wordId', element: <div>word detail page</div>},
      ],
      {initialEntries: ['/']},
    )

    const {container} = render(<RouterProvider router={router} />)

    fireEvent.click(screen.getByRole('button', {name: /basic/i}))

    const overlay = container.querySelector('.level-dropdown-overlay')
    expect(overlay).not.toBeNull()

    fireEvent.click(overlay!)

    expect(screen.getByText('alpha')).toBeTruthy()
    expect(screen.queryByText('word detail page')).toBeNull()
    expect(container.querySelector('.level-dropdown-overlay')).toBeNull()
  })
})
