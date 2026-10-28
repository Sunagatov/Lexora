import type {Word} from '@/features/words/types/wordTypes'

export function EasyPronunciation({word}: {word: Word}) {
  if (!word.pronunciation_easy) return null
  return <span className="word-easy-pronunciation" lang="ru" dir="ltr"
    title={word.pronunciation_note_ru || 'Приблизительное произношение русскими буквами. Для точности слушайте аудио.'}>
    {word.pronunciation_easy}
  </span>
}
