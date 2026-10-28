import type {LearningLanguage} from './api'
import {LEARNING_LANGUAGES} from './api'

export type PronunciationMode = 'easy' | 'pinyin' | 'ipa'
export type PronunciationPreferences = Partial<Record<LearningLanguage, PronunciationMode>>
const storageKey = 'lexora-pronunciation-preferences'
const listeners = new Set<() => void>()

function read(): PronunciationPreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? '{}')
    return Object.fromEntries(LEARNING_LANGUAGES.flatMap(({code}) => {
      const mode = saved?.[code]
      return mode === 'easy' || mode === 'ipa' || (code === 'zh' && mode === 'pinyin') ? [[code, mode]] : []
    }))
  } catch { return {} }
}

let preferences = read()
export const pronunciationPreferences = () => preferences
export const pronunciationMode = (language: string): PronunciationMode => preferences[language as LearningLanguage] ?? 'easy'
export function subscribePronunciation(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export function setPronunciationPreferences(value: PronunciationPreferences) {
  preferences = {...value}
  try { localStorage.setItem(storageKey, JSON.stringify(preferences)) } catch { /* Keep the choice for this tab. */ }
  listeners.forEach(listener => listener())
}
