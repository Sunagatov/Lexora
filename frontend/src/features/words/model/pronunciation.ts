import {useSyncExternalStore} from 'react'
import {pronunciationMode, subscribePronunciation, type PronunciationMode} from '@/features/languages/pronunciationPreferences'
import type {Word} from '@/features/words/types/wordTypes'

export function usePronunciationMode(language: string) {
  return useSyncExternalStore(subscribePronunciation, () => pronunciationMode(language))
}

export function pronunciationText(word: Word, mode: PronunciationMode) {
  if (mode === 'pinyin') return word.language === 'zh' ? word.transliteration : null
  if (mode === 'ipa') return word.pronunciation_ipa
  return word.pronunciation_easy
}
