import {afterEach, expect, it, vi} from 'vitest'
import {onLanguageChange} from '../api'
import {pronunciationMode, setPronunciationPreferences} from '../pronunciationPreferences'

afterEach(() => { setPronunciationPreferences({}); onLanguageChange(() => {}) })

it('remembers a separate pronunciation choice for each language without resetting vocabulary data', () => {
  const resetData = vi.fn()
  onLanguageChange(resetData)
  setPronunciationPreferences({zh: 'pinyin', de: 'ipa'})
  expect(pronunciationMode('zh')).toBe('pinyin')
  expect(pronunciationMode('de')).toBe('ipa')
  expect(pronunciationMode('es')).toBe('easy')
  expect(resetData).not.toHaveBeenCalled()
  expect(JSON.parse(localStorage.getItem('lexora-pronunciation-preferences')!)).toEqual({zh: 'pinyin', de: 'ipa'})
})

it('loads valid saved choices and ignores broken or language-inappropriate values', async () => {
  localStorage.setItem('lexora-pronunciation-preferences', JSON.stringify({zh: 'pinyin', tr: 'pinyin', de: 'other', fr: 'ipa'}))
  vi.resetModules()
  const saved = await import('../pronunciationPreferences')
  expect(saved.pronunciationMode('zh')).toBe('pinyin')
  expect(saved.pronunciationMode('tr')).toBe('easy')
  expect(saved.pronunciationMode('de')).toBe('easy')
  expect(saved.pronunciationMode('fr')).toBe('ipa')
  saved.setPronunciationPreferences({})
})
