import type {Word} from '../../shared/types'

export function lexicalChips(word: Word): string[] {
  const chips: string[] = []
  if (word.part_of_speech) chips.push(word.part_of_speech)
  if (word.past_simple || word.past_participle) chips.push('irregular')
  if (word.countability) chips.push(word.countability.toLowerCase())
  return chips
}

export function smartPreview(word: Word): {label: string; text: string} | null {
  const pos = word.part_of_speech?.toLowerCase()
  if (word.past_simple || word.past_participle) {
    return {label: 'Forms', text: [word.term, word.past_simple, word.past_participle].filter(Boolean).join(' · ')}
  }
  if (pos === 'verb' && word.pattern)        return {label: 'Pattern', text: word.pattern}
  if ((pos === 'phrase' || pos === 'preposition') && word.notes) return {label: 'Notes', text: word.notes}
  if (word.pattern)  return {label: 'Pattern', text: word.pattern}
  if (word.example)  return {label: 'Example', text: word.example}
  if (word.notes)    return {label: 'Notes',   text: word.notes}
  return null
}
