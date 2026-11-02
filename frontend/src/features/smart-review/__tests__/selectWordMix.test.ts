import {selectWordMix} from '../model/selectWordMix'
import type {Word} from '@/features/words/types/wordTypes'
import {DEFAULT_PREFERENCES} from '@/features/preferences/api'

const preferences = {...DEFAULT_PREFERENCES.word_mix, size: 50, cooldown_days: 0}
const words = Array.from({length: 90}, (_, i) => ({id: i + 1, term: `word ${i}`, is_active: true,
  knowledge_level: 1, cefr_level: 'A1', topic_ids: [i < 60 ? 1 : 2], deleted_at: null} as Word))

it('honours the configured size and balances topics without repeating words', () => {
  const selected = selectWordMix(words, preferences)
  expect(selected).toHaveLength(50)
  expect(new Set(selected.map(word => word.id)).size).toBe(50)
  expect(selected.filter(word => word.topic_ids[0] === 1)).toHaveLength(25)
  expect(selectWordMix(words.slice(0, 60), preferences)).toHaveLength(50)
})

it('combines knowledge, CEFR, deleted status and cooldown filters', () => {
  const now = Date.parse('2026-11-02T12:00:00Z')
  const data = [words[0], {...words[1], knowledge_level: 4}, {...words[2], cefr_level: 'B1'},
    {...words[3], deleted_at: '2026-10-01'}, {...words[4], is_active: false}, words[5]] as Word[]
  const selected = selectWordMix(data, {...preferences, cefr_levels: ['A1'], cooldown_days: 7}, {1: '2026-11-01T12:00:00Z'}, now)
  expect(selected.map(word => word.id)).toEqual([6])
})

it('returns fewer words when necessary and allows repeat cooldown to be turned off', () => {
  expect(selectWordMix([], preferences)).toEqual([])
  expect(selectWordMix(words.slice(0, 3), preferences, {1: new Date().toISOString()})).toHaveLength(3)
  expect(selectWordMix(words, {...preferences, size: 75, balance_topics: false})).toHaveLength(75)
})
