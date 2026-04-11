import type {Word, WordKnowledgeLevel} from './http'

export type SortOption = 'term-asc' | 'term-desc' | 'level-asc' | 'level-desc'

export const LEVELS: WordKnowledgeLevel[] = [1, 2, 3, 4, 5]

// Levels 1-4 are active study levels. Level 5 means "parked" — too rare/strange to study now.
export const ACTIVE_LEVELS: WordKnowledgeLevel[] = [1, 2, 3, 4]
export const PARKED_LEVEL: WordKnowledgeLevel = 5

export const LEVEL_LABELS: Record<number, string> = {
  1: 'Weak', 2: 'Basic', 3: 'Okay', 4: 'Strong', 5: 'Parked',
}

export function levelClass(level: number | null): string {
  return level ? `level-${level}` : 'level-unset'
}

// Progress summary only counts active study levels (1-4). Level 5 (Parked) is excluded.
export function buildLevelSummary(words: Word[]): Record<WordKnowledgeLevel, number> {
  const s: Record<WordKnowledgeLevel, number> = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
  for (const w of words) {
    const l = w.knowledge_level
    if (l && l >= 1 && l <= 5) s[l as WordKnowledgeLevel]++
  }
  return s
}

// Level 5 (Parked) always sorts last regardless of sort direction
function sortKey(level: number | null, asc: boolean): number {
  if (level === 5) return asc ? 98 : -1   // last in asc, last in desc
  if (level === null) return asc ? 99 : -2
  return level
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
      case 'level-asc':  return sortKey(a.knowledge_level, true)  - sortKey(b.knowledge_level, true)
      case 'level-desc': return sortKey(b.knowledge_level, false) - sortKey(a.knowledge_level, false)
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
