import type {Word, WordKnowledgeLevel} from '../../shared/types'

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

/** Converts a WordKnowledgeLevel to its string form for form state (null → ''). */
export function levelToStr(v: WordKnowledgeLevel | null | undefined): string { return v != null ? String(v) : '' }

/** Parses a form string back to a WordKnowledgeLevel ('' → null). */
export function strToLevel(v: string): WordKnowledgeLevel | null { return v ? Number(v) as WordKnowledgeLevel : null }

// Counts all levels 1-5. Level 5 (Parked) is included in the summary data
// but excluded from the progress chips at render time (StudyPage shows only ACTIVE_LEVELS).
export function buildLevelSummary(words: Word[]): Record<WordKnowledgeLevel, number> {
  const s: Record<WordKnowledgeLevel, number> = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
  for (const w of words) {
    const l = w.knowledge_level
    if (l && l >= 1 && l <= 5) s[l as WordKnowledgeLevel]++
  }
  return s
}

// Level 5 (Parked) always sorts last regardless of sort direction.
// Returns a sort key where higher = later in the list.
function sortKey(level: number | null): number {
  if (level === 5)    return 98   // Parked: always near last
  if (level === null) return 99   // Unset: always last
  return level                    // 1-4: natural order
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

  const result = words.filter((w) => {
    if (levelFilter !== 'all' && w.knowledge_level !== levelFilter && !frozenSet?.has(w.id)) return false
    if (!needle) return true
    return [w.term, w.translations, w.part_of_speech, w.pattern, w.example, w.notes, w.past_simple, w.past_participle]
      .some((v) => v?.toLowerCase().trim().includes(needle))
  })

  result.sort((a, b) => {
    switch (sortBy) {
      case 'term-asc':   return a.term.localeCompare(b.term)
      case 'term-desc':  return b.term.localeCompare(a.term)
      // level-asc: 1 first, 4 last among active, then Parked, then null
      case 'level-asc':  return sortKey(a.knowledge_level) - sortKey(b.knowledge_level)
      // level-desc: 4 first, 1 last among active, then Parked, then null
      // Negate only active levels (1-4); keep Parked/null at the end by using large positive values
      case 'level-desc': {
        const ka = sortKey(a.knowledge_level)
        const kb = sortKey(b.knowledge_level)
        // For active levels (1-4), higher level = earlier = smaller sort value when descending
        const da = ka >= 98 ? ka : (5 - ka)   // 4→1, 3→2, 2→3, 1→4; parked/null stay large
        const db = kb >= 98 ? kb : (5 - kb)
        return da - db
      }
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
