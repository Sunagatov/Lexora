import type {Word} from '@/features/words/types/wordTypes'
import {levelToStr, strToLevel} from '@/features/words/model/wordDomain'
import {toStr, toNullStr, toNullStrIf} from '@/shared/lib/utils'

export type EditState = {
  language?: string
  term: string
  translations: string
  knowledge_level: string
  part_of_speech: string
  topic_ids: string[]
  definition: string
  pronunciation_ipa: string
  transliteration?: string
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

function splitExamples(value: string): string[] {
  const blocks = value.trim().split(/\r?\n\s*\r?\n/)
  return blocks.flatMap(block => {
    const lines = splitMultiline(block)
    const source = lines[0]?.match(/^([A-Z]{2}):/i)?.[1].toUpperCase()
    // Blank lines preserve boundaries, including EN source + RU + EN gloss.
    if (source && lines.slice(1).every(line => /^(RU|EN):/i.test(line))
      && lines.filter(line => /^RU:/i.test(line)).length <= 1
      && lines.filter(line => /^EN:/i.test(line)).length <= (source === 'EN' ? 2 : 1)) {
      return [lines.join('\n')]
    }
    return splitLegacyExamples(block)
  })
}

function splitLegacyExamples(value: string): string[] {
  const examples: string[] = []
  for (const line of splitMultiline(value)) {
    const previous = examples[examples.length - 1]
    const source = previous?.match(/^([A-Z]{2}):/i)?.[1].toUpperCase()
    const label = line.match(/^(RU|EN):/i)?.[1].toUpperCase()
    const labels = previous?.split('\n').map(value => value.slice(0, 2).toUpperCase()) ?? []
    // Keep a labelled translation with the immediately preceding source sentence.
    if (label && source && source !== 'RU' && label !== source && !labels.includes(label)) {
      examples[examples.length - 1] = `${previous}\n${line}`
    } else {
      examples.push(line)
    }
  }
  return examples
}

export function toEditState(word: Word): EditState {
  return {
    term: word.term,
    language: word.language,
    translations: word.translation_entries.length ? word.translation_entries.join('\n') : '',
    knowledge_level: levelToStr(word.knowledge_level),
    part_of_speech: toStr(word.part_of_speech),
    topic_ids: word.topic_ids.map(String),
    definition: toStr(word.definition),
    pronunciation_ipa: toStr(word.pronunciation_ipa),
    transliteration: toStr(word.transliteration),
    cefr_level: toStr(word.cefr_level),
    register: toStr(word.register),
    countability: toStr(word.countability),
    frequency_rank: word.frequency_rank != null ? String(word.frequency_rank) : '',
    past_simple: toStr(word.verb_form?.past_simple),
    past_participle: toStr(word.verb_form?.past_participle),
    present_participle: toStr(word.verb_form?.present_participle),
    third_person: toStr(word.verb_form?.third_person),
    example: word.example_entries.length ? word.example_entries.join('\n\n') : '',
    synonyms: word.synonym_entries.length ? word.synonym_entries.join('\n') : '',
    antonyms: word.antonym_entries.length ? word.antonym_entries.join('\n') : '',
    collocations: word.collocation_entries.length ? word.collocation_entries.join('\n') : '',
    notes: toStr(word.notes),
    pattern: toStr(word.pattern),
  }
}

export function buildSavePayload(draft: EditState, isVerb: boolean, isNoun: boolean): Partial<Word> {
  const topicIds = Array.from(new Set(draft.topic_ids.map(Number).filter((n) => Number.isInteger(n) && n !== 0)))
  const translationEntries = splitMultiline(draft.translations)
  const exampleEntries = splitExamples(draft.example)
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
    transliteration: toNullStr(draft.transliteration ?? ''),
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

export function buildChangedSavePayload(draft: EditState, initial: EditState): Partial<Word> {
  const payloadFor = (state: EditState) => buildSavePayload(state,
    (state.language ?? 'en') === 'en' && (state.part_of_speech === 'verb' || state.part_of_speech === 'phrasal verb'), state.part_of_speech === 'noun')
  const before = payloadFor(initial)
  return Object.fromEntries(Object.entries(payloadFor(draft))
    .filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(before[key as keyof Word])))
}
