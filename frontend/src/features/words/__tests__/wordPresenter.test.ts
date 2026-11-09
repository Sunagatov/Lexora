import type {Word} from '@/features/words/types/wordTypes'
import {formatIpa, smartPreview} from '@/features/words/model/wordPresenter'

it.each([
  ['pɪɡ', '/pɪɡ/'], ['/pɪɡ/', '/pɪɡ/'], ['//pɪɡ//', '/pɪɡ/'],
  [' /pɪɡ/ ', '/pɪɡ/'], ['[pɪɡ]', '[pɪɡ]'], ['', ''], ['//', ''],
])('formats IPA %j as %j', (value, expected) => {
  expect(formatIpa(value)).toBe(expected)
})


it.each([
  ['en', 'verb', true], ['en', 'phrasal verb', true],
  ['en', 'noun', false], ['de', 'verb', false],
])('scopes preserved verb metadata to English verbs (%s, %s)', (language, part_of_speech, showForms) => {
  const word = {language, part_of_speech, term: 'run', verb_form: {past_simple: 'ran'},
    example_entries: ['A morning run.']} as Word
  expect(smartPreview(word)?.label).toBe(showForms ? 'Forms' : 'Example')
})
