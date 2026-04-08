import type {Word, WordKnowledgeLevel} from './http'

export type SortOption = 'term-asc' | 'term-desc' | 'level-asc' | 'level-desc'

export const LEVELS: WordKnowledgeLevel[] = [1, 2, 3, 4, 5]

export const LEVEL_LABELS: Record<number, string> = {
  1: 'Weak', 2: 'Basic', 3: 'Okay', 4: 'Strong', 5: 'Master',
}

export function levelClass(level: number | null): string {
  return level ? `level-${level}` : 'level-unset'
}

export function buildLevelSummary(words: Word[]): Record<WordKnowledgeLevel, number> {
  const s: Record<WordKnowledgeLevel, number> = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
  for (const w of words) {
    const l = w.knowledge_level
    if (l && l >= 1 && l <= 5) s[l as WordKnowledgeLevel]++
  }
  return s
}

export function filterAndSort(
  words: Word[],
  search: string,
  levelFilter: 'all' | WordKnowledgeLevel,
  sortBy: SortOption,
  frozenIds: number[] | null,
): Word[] {
  const needle = search.toLowerCase().trim()
  const frozenSet = frozenIds ? new Set(frozenIds) : null

  let result = words.filter((w) => {
    if (levelFilter !== 'all' && w.knowledge_level !== levelFilter && !frozenSet?.has(w.id)) return false
    if (!needle) return true
    return [w.term, w.translations, w.part_of_speech, w.pattern, w.example, w.notes, w.past_simple, w.past_participle]
      .some((v) => v?.toLowerCase().trim().includes(needle))
  })

  result.sort((a, b) => {
    switch (sortBy) {
      case 'term-asc':   return a.term.localeCompare(b.term)
      case 'term-desc':  return b.term.localeCompare(a.term)
      case 'level-asc':  return (a.knowledge_level ?? 99) - (b.knowledge_level ?? 99)
      case 'level-desc': return (b.knowledge_level ?? 0)  - (a.knowledge_level ?? 0)
    }
  })

  if (!frozenIds) return result

  const idx = new Map(frozenIds.map((id, i) => [id, i]))
  return [...result].sort((a, b) => {
    const ai = idx.get(a.id), bi = idx.get(b.id)
    if (ai !== undefined && bi !== undefined) return ai - bi
    if (ai !== undefined) return -1
    if (bi !== undefined) return 1
    return 0
  })
}
