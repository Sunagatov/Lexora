import type {Word} from '@/features/words/types/wordTypes'
import type {PronunciationMode} from '@/features/languages/pronunciationPreferences'
import {pronunciationText, usePronunciationMode} from '@/features/words/model/pronunciation'
import {usePreferences} from '@/features/preferences/api'

export function EasyPronunciation({word, mode}: {word: Word; mode?: PronunciationMode}) {
  const selectedMode = usePronunciationMode(word.language)
  const preferences = usePreferences()
  const display = mode ?? selectedMode
  const value = pronunciationText(word, display)
  if (!value || !preferences.pronunciation) return null
  const title = display === 'easy' ? word.pronunciation_note_ru || 'Приблизительное произношение русскими буквами. Для точности слушайте аудио.'
    : display === 'pinyin' ? 'Pinyin with tone marks' : 'International Phonetic Alphabet'
  return <span className="word-easy-pronunciation" lang={display === 'easy' ? 'ru' : display === 'pinyin' ? 'zh-Latn' : 'und-fonipa'} dir="ltr" title={title}>
    {value}
  </span>
}
