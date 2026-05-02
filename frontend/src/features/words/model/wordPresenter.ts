import type {Word} from '@/features/words/types/wordTypes'

export function lexicalChips(word: Word): string[] {
  const chips: string[] = []
  if (word.part_of_speech) chips.push(word.part_of_speech)
  if (word.verb_form?.past_simple || word.verb_form?.past_participle) chips.push('irregular')
  if (word.countability) chips.push(word.countability.toLowerCase())
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
