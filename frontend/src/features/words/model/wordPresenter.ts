import type {Word} from '@/features/words/types/wordTypes'

export type ChipType = 'pos' | 'cefr' | 'countability' | 'register'
export type LexicalChip = {label: string; type: ChipType}

export function lexicalChips(word: Word): LexicalChip[] {
  const chips: LexicalChip[] = []
  if (word.part_of_speech) chips.push({label: word.part_of_speech, type: 'pos'})
  if (word.cefr_level) chips.push({label: word.cefr_level, type: 'cefr'})
  if (word.countability) chips.push({label: word.countability.toLowerCase(), type: 'countability'})
  if (word.register && word.register.toLowerCase() !== 'neutral') chips.push({label: word.register, type: 'register'})
  return chips
}

export function smartPreview(word: Word): {label: string; text: string} | null {
  const pos = word.part_of_speech?.toLowerCase()
  if (word.verb_form?.past_simple || word.verb_form?.past_participle) {
    return {label: 'Forms', text: [word.term, word.verb_form?.past_simple, word.verb_form?.past_participle].filter(Boolean).join(' · ')}
  }
  if (pos === 'verb' && word.pattern)        return {label: 'Pattern', text: word.pattern}
  if ((pos === 'phrase' || pos === 'preposition') && word.notes) return {label: 'Notes', text: word.notes}
  if (word.pattern)  return {label: 'Pattern', text: word.pattern}
  if (word.example_entries.length)  return {label: 'Example', text: word.example_entries[0]}
  if (word.notes)    return {label: 'Notes',   text: word.notes}
  return null
}

export function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text
}
