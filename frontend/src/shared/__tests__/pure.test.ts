import {describe, it, expect} from 'vitest'
import {filterAndSort, buildLevelSummary} from '@/features/words/model/wordDomain'
import {slugify} from '@/shared/lib/slugify'
import {smartPreview} from '@/features/words/model/wordPresenter'
import type {Word} from '@/features/words/types/wordTypes'

function makeWord(overrides: Partial<Word> = {}): Word {
  return {
    id: 1, topic_ids: [1], term: 'test',
    language: 'en', definition: null,
    pronunciation_ipa: null, pronunciation_audio_url: null,
    image_url: null, cefr_level: null, register: null,
    frequency_rank: null, verb_form: null,
    translation_entries: ['тест'],
    part_of_speech: null, knowledge_level: null, countability: null, pattern: null,
    example_entries: [], example_count: 0, example_target_count: 3,
    example_status: 'missing', needs_example_enrichment: false,
    synonym_entries: [], antonym_entries: [], collocation_entries: [], confusable_entries: [],
    notes: null, is_active: true, deleted_at: null,
    created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('buildLevelSummary', () => {
  it('counts words by level', () => {
    const words = [makeWord({knowledge_level: 1}), makeWord({knowledge_level: 1}), makeWord({knowledge_level: 3})]
    const s = buildLevelSummary(words)
    expect(s[1]).toBe(2)
    expect(s[3]).toBe(1)
    expect(s[2]).toBe(0)
  })

  it('ignores null knowledge_level', () => {
    const s = buildLevelSummary([makeWord({knowledge_level: null})])
    expect(Object.values(s).every((v) => v === 0)).toBe(true)
  })
})

describe('filterAndSort', () => {
  const words = [
    makeWord({id: 1, term: 'apple',  knowledge_level: 1, translation_entries: ['яблоко']}),
    makeWord({id: 2, term: 'banana', knowledge_level: 3, translation_entries: ['банан']}),
    makeWord({id: 3, term: 'cherry', knowledge_level: 2, translation_entries: ['вишня']}),
  ]

  const defaultOpts = {search: '', levelFilter: 'all' as const, posFilter: null, cefrFilter: null, completeness: 'all' as const, sortBy: 'term-asc' as const, frozenIds: null}

  it('returns all words with no filter', () => {
    expect(filterAndSort(words, defaultOpts)).toHaveLength(3)
  })

  it('filters by search term', () => {
    const result = filterAndSort(words, {...defaultOpts, search: 'apple'})
    expect(result).toHaveLength(1)
    expect(result[0].term).toBe('apple')
  })

  it('filters by translation', () => {
    const result = filterAndSort(words, {...defaultOpts, search: 'банан'})
    expect(result[0].term).toBe('banana')
  })

  it('filters by level', () => {
    const result = filterAndSort(words, {...defaultOpts, levelFilter: 3})
    expect(result).toHaveLength(1)
    expect(result[0].term).toBe('banana')
  })

  it('sorts term-asc', () => {
    const result = filterAndSort(words, defaultOpts)
    expect(result.map((w) => w.term)).toEqual(['apple', 'banana', 'cherry'])
  })

  it('sorts term-desc', () => {
    const result = filterAndSort(words, {...defaultOpts, sortBy: 'term-desc'})
    expect(result.map((w) => w.term)).toEqual(['cherry', 'banana', 'apple'])
  })

  it('sorts level-asc: lowest level first', () => {
    const result = filterAndSort(words, {...defaultOpts, sortBy: 'level-asc'})
    expect(result[0].knowledge_level).toBe(1)
    expect(result[2].knowledge_level).toBe(3)
  })

  it('sorts level-desc: highest level first', () => {
    const result = filterAndSort(words, {...defaultOpts, sortBy: 'level-desc'})
    expect(result[0].knowledge_level).toBe(3)
    expect(result[2].knowledge_level).toBe(1)
  })

  it('respects frozenIds order', () => {
    const result = filterAndSort(words, {...defaultOpts, frozenIds: [3, 1, 2]})
    expect(result.map((w) => w.id)).toEqual([3, 1, 2])
  })
})

describe('smartPreview', () => {
  it('returns verb forms when past_simple present', () => {
    const w = makeWord({term: 'go', verb_form: {past_simple: 'went', past_participle: 'gone', present_participle: null, third_person: null}})
    const p = smartPreview(w)
    expect(p?.label).toBe('Forms')
    expect(p?.text).toContain('went')
  })

  it('returns pattern for verb with pattern', () => {
    const w = makeWord({part_of_speech: 'verb', pattern: 'to do sth'})
    const p = smartPreview(w)
    expect(p?.label).toBe('Pattern')
    expect(p?.text).toBe('to do sth')
  })

  it('returns example when no other priority matches', () => {
    const w = makeWord({example_entries: ['She runs fast.']})
    const p = smartPreview(w)
    expect(p?.label).toBe('Example')
  })

  it('returns null when no preview data', () => {
    expect(smartPreview(makeWord())).toBeNull()
  })
})

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('strips special characters', () => {
    expect(slugify('cafe resume')).toBe('cafe-resume')
  })

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  test  ')).toBe('test')
  })

  it('truncates to 200 chars', () => {
    expect(slugify('a'.repeat(300))).toHaveLength(200)
  })

  it('falls back to topic for empty result', () => {
    expect(slugify('   ')).toBe('topic')
  })
})
