import {describe, expect, it} from 'vitest'
import {buildChangedSavePayload, buildSavePayload, toEditState} from '@/features/words/model/wordForm'
import type {Word} from '@/features/words/types/wordTypes'
import {filterAndSort} from '@/features/words/model/wordDomain'

describe('multilingual example editing', () => {
  it('edits English source/Russian/English blocks without splitting or duplicating them', () => {
    const examples = ['One', 'Two', 'Three'].map(s => `EN: ${s}\nRU: Перевод ${s}\nEN: ${s}`)
    const word = {term: 'example', language: 'en', translation_entries: ['пример'], topic_ids: [1],
      example_entries: examples, synonym_entries: [], antonym_entries: [], collocation_entries: []} as unknown as Word
    const initial = toEditState(word)
    expect(buildChangedSavePayload(initial, initial)).toEqual({})
    const changed = {...initial, example: initial.example.replace('RU: Перевод One', 'RU: Новый перевод')}
    expect(buildChangedSavePayload(changed, initial).example_entries).toEqual([
      examples[0].replace('RU: Перевод One', 'RU: Новый перевод'), ...examples.slice(1),
    ])
  })
  it.each(['ZH: 你好！', 'TT: Сәлам!', 'AR: مرحبًا!'])('preserves three-line source/Russian/English blocks: %s', source => {
    const example = `${source}\nRU: Привет!\nEN: Hello!`
    const word = {term: 'hello', language: source.slice(0, 2).toLowerCase(), translation_entries: ['привет'], topic_ids: [],
      example_entries: [example], synonym_entries: [], antonym_entries: [], collocation_entries: []} as unknown as Word
    const draft = toEditState(word)
    expect(buildSavePayload(draft, false, false).example_entries).toEqual([example])
    draft.example = example.replace('Привет!', 'Здравствуйте!')
    expect(buildSavePayload(draft, false, false).example_entries).toEqual([draft.example])
  })
})

it.each(['ni hao', 'nihao', 'nǐ hǎo', 'ni3hao3'])('matches Mandarin topic filtering without requiring tone marks: %s', search => {
  const word = {id: 1, term: '你好', language: 'zh', transliteration: 'nǐ hǎo', topic_ids: [1],
    translation_entries: ['привет'], example_entries: []} as unknown as Word
  expect(filterAndSort([word], {search, levelFilter: 'all', posFilter: null, cefrFilter: null,
    completeness: 'all', sortBy: 'term-asc', frozenIds: null})).toEqual([word])
})
