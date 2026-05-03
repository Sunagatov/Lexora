import type {Word} from '@/features/words/types/wordTypes'
import {levelToStr, strToLevel} from '@/features/words/model/wordDomain'
import {toStr, toNullStr, toNullStrIf} from '@/shared/lib/utils'

export type EditState = {
  term: string
  translations: string
  knowledge_level: string
  part_of_speech: string
  topic_ids: string[]
  definition: string
  pronunciation_ipa: string
  cefr_level: string
  register: string
  countability: string
  frequency_rank: string
  past_simple: string
  past_participle: string
  present_participle: string
  third_person: string
  example: string
  synonyms: string
  antonyms: string
  collocations: string
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
    translations: word.translation_entries.length ? word.translation_entries.join('\n') : '',
    knowledge_level: levelToStr(word.knowledge_level),
    part_of_speech: toStr(word.part_of_speech),
    topic_ids: word.topic_ids.map(String),
    definition: toStr(word.definition),
    pronunciation_ipa: toStr(word.pronunciation_ipa),
    cefr_level: toStr(word.cefr_level),
    register: toStr(word.register),
    countability: toStr(word.countability),
    frequency_rank: word.frequency_rank != null ? String(word.frequency_rank) : '',
    past_simple: toStr(word.verb_form?.past_simple),
    past_participle: toStr(word.verb_form?.past_participle),
    present_participle: toStr(word.verb_form?.present_participle),
    third_person: toStr(word.verb_form?.third_person),
    example: word.example_entries.length ? word.example_entries.join('\n') : '',
    synonyms: word.synonym_entries.length ? word.synonym_entries.join('\n') : '',
    antonyms: word.antonym_entries.length ? word.antonym_entries.join('\n') : '',
    collocations: word.collocation_entries.length ? word.collocation_entries.join('\n') : '',
    notes: toStr(word.notes),
    pattern: toStr(word.pattern),
  }
}

export function buildSavePayload(draft: EditState, isVerb: boolean, isNoun: boolean): Partial<Word> {
  const topicIds = Array.from(new Set(draft.topic_ids.map(Number).filter((n) => n > 0)))
  const translationEntries = splitMultiline(draft.translations)
  const exampleEntries = splitMultiline(draft.example)
  const synonymEntries = splitMultiline(draft.synonyms)
  const antonymEntries = splitMultiline(draft.antonyms)
  const collocationEntries = splitMultiline(draft.collocations)
  const freqRank = draft.frequency_rank.trim() ? Number(draft.frequency_rank.trim()) : null

  return {
    term: draft.term.trim(),
    translation_entries: translationEntries,
    knowledge_level: strToLevel(draft.knowledge_level),
    part_of_speech: toNullStr(draft.part_of_speech),
    topic_ids: topicIds,
    definition: toNullStr(draft.definition),
    pronunciation_ipa: toNullStr(draft.pronunciation_ipa),
    cefr_level: toNullStr(draft.cefr_level),
    register: toNullStr(draft.register),
    countability: toNullStrIf(isNoun, draft.countability),
    frequency_rank: freqRank && freqRank >= 1 ? freqRank : null,
    verb_form: isVerb ? {
      past_simple: toNullStr(draft.past_simple) ?? null,
      past_participle: toNullStr(draft.past_participle) ?? null,
      present_participle: toNullStr(draft.present_participle) ?? null,
      third_person: toNullStr(draft.third_person) ?? null,
    } : null,
    example_entries: exampleEntries,
    synonym_entries: synonymEntries,
    antonym_entries: antonymEntries,
    collocation_entries: collocationEntries,
    notes: toNullStr(draft.notes),
    pattern: toNullStr(draft.pattern),
  }
}
