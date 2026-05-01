import type {Word} from '@/features/words/types/wordTypes'
import {levelToStr, strToLevel} from '@/features/words/model/wordDomain'
import {toStr, toNullStr, toNullStrIf} from '@/shared/lib/utils'

export type EditState = {
  term: string
  translations: string
  knowledge_level: string
  part_of_speech: string
  topic_ids: string[]
  countability: string
  past_simple: string
  past_participle: string
  example: string
  notes: string
  pattern: string
}

function splitMultiline(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

export function toEditState(word: Word): EditState {
  return {
    term: word.term,
    translations: word.translation_entries?.length ? word.translation_entries.join('\n') : word.translations,
    knowledge_level: levelToStr(word.knowledge_level),
    part_of_speech: toStr(word.part_of_speech),
    topic_ids: word.topic_ids.map(String),
    countability: toStr(word.countability),
    past_simple: toStr(word.past_simple),
    past_participle: toStr(word.past_participle),
    example: word.example_entries?.length ? word.example_entries.join('\n') : toStr(word.example),
    notes: toStr(word.notes),
    pattern: toStr(word.pattern),
  }
}

export function buildSavePayload(draft: EditState, isVerb: boolean, isNoun: boolean): Partial<Word> {
  const topicIds = Array.from(new Set(draft.topic_ids.map(Number).filter((n) => n > 0)))
  const translationEntries = splitMultiline(draft.translations)
  const exampleEntries = splitMultiline(draft.example)

  return {
    term: draft.term.trim(),
    translations: draft.translations.trim(),
    translation_entries: translationEntries,
    knowledge_level: strToLevel(draft.knowledge_level),
    part_of_speech: toNullStr(draft.part_of_speech),
    topic_ids: topicIds,
    countability: toNullStrIf(isNoun, draft.countability),
    past_simple: toNullStrIf(isVerb, draft.past_simple),
    past_participle: toNullStrIf(isVerb, draft.past_participle),
    example: toNullStr(draft.example),
    example_entries: exampleEntries,
    notes: toNullStr(draft.notes),
    pattern: toNullStr(draft.pattern),
  }
}
