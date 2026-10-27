import {describe, expect, it} from 'vitest'
import {buildSavePayload, toEditState} from '@/features/words/model/wordForm'
import type {Word} from '@/features/words/types/wordTypes'

describe('multilingual example editing', () => {
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
