import {render, screen} from '@testing-library/react'
import {WordPageView} from '@/features/words/components/WordPageView'
import type {Word} from '@/features/words/types/wordTypes'

const word: Word = {
  id: 1, term: 'apple', language: 'en', topic_ids: [], translation_entries: [],
  definition: null, pronunciation_ipa: null, pronunciation_audio_url: null, image_url: null,
  part_of_speech: null, cefr_level: 'A1', register: null, countability: null,
  frequency_rank: null, knowledge_level: null, pattern: null, notes: null, is_active: true,
  verb_form: null, example_entries: [], example_count: 0, example_target_count: 3,
  example_status: 'missing', needs_example_enrichment: true, synonym_entries: [],
  antonym_entries: [], collocation_entries: [], confusable_entries: [], deleted_at: null,
  created_at: '2026-10-14T00:00:00Z', updated_at: '2026-10-14T00:00:00Z',
}

it('shows CEFR when no other grammar fields are saved', () => {
  render(<WordPageView word={word} topics={[]} hidePOS />)
  expect(screen.getByRole('heading', {name: 'Grammar'})).toBeTruthy()
  expect(screen.getByText('A1')).toBeTruthy()
})

it('keeps easy pronunciation, its note and IPA separate', () => {
  render(<WordPageView word={{...word, pronunciation_easy: 'о́ла', pronunciation_note_ru: 'Русская подсказка', pronunciation_ipa: 'ˈola'}} topics={[]} />)
  expect(screen.getByText('о́ла')).toBeTruthy()
  expect(screen.getByText('Русская подсказка')).toBeTruthy()
  expect(screen.getByText('/ˈola/')).toBeTruthy()
})

it('omits the grammar section when all its visible fields are empty', () => {
  render(<WordPageView word={{...word, cefr_level: null, part_of_speech: 'noun'}} topics={[]} hidePOS />)
  expect(screen.queryByRole('heading', {name: 'Grammar'})).toBeNull()
})
