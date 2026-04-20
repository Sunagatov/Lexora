import type {Word} from '../../shared/types'
import {levelToStr, strToLevel} from '../../shared/wordDomain'
import {toStr, toNullStr, toNullStrIf} from '../../shared/utils'

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

export function toEditState(word: Word): EditState {
  return {
    term: word.term,
    translations: word.translations,
    knowledge_level: levelToStr(word.knowledge_level),
    part_of_speech: toStr(word.part_of_speech),
    topic_ids: word.topic_ids.map(String),
    countability: toStr(word.countability),
    past_simple: toStr(word.past_simple),
    past_participle: toStr(word.past_participle),
    example: toStr(word.example),
    notes: toStr(word.notes),
    pattern: toStr(word.pattern),
  }
}

export function buildSavePayload(draft: EditState, isVerb: boolean, isNoun: boolean): Partial<Word> {
  const topicIds = Array.from(new Set(draft.topic_ids.map(Number).filter((n) => n > 0)))

  return {
    term: draft.term.trim(),
    translations: draft.translations.trim(),
    knowledge_level: strToLevel(draft.knowledge_level),
    part_of_speech: toNullStr(draft.part_of_speech),
    topic_ids: topicIds,
    countability: toNullStrIf(isNoun, draft.countability),
    past_simple: toNullStrIf(isVerb, draft.past_simple),
    past_participle: toNullStrIf(isVerb, draft.past_participle),
    example: toNullStr(draft.example),
    notes: toNullStr(draft.notes),
    pattern: toNullStr(draft.pattern),
  }
}
