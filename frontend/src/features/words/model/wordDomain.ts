import type {Word, WordKnowledgeLevel} from '@/features/words/types/wordTypes'

export type SortOption = 'term-asc' | 'term-desc' | 'level-asc' | 'level-desc' | 'cefr-asc' | 'cefr-desc' | 'newest' | 'oldest'
export const WORD_SORT_OPTIONS = ['term-asc', 'term-desc', 'level-asc', 'level-desc', 'cefr-asc', 'cefr-desc', 'newest', 'oldest'] as const
export const DEFAULT_WORD_SORT: SortOption = 'level-asc'
export const LEVEL_SORT_OPTIONS = ['level-asc', 'level-desc'] as const
export const TERM_SORT_OPTIONS = ['term-asc', 'term-desc'] as const
export const CEFR_SORT_OPTIONS = ['cefr-asc', 'cefr-desc'] as const
export const DATE_SORT_OPTIONS = ['newest', 'oldest'] as const
export const DEFAULT_WORD_PROGRESS_SOURCE = 'study_list'

export const LEVELS: WordKnowledgeLevel[] = [1, 2, 3, 4, 5]

export const ACTIVE_LEVELS: WordKnowledgeLevel[] = [1, 2, 3, 4]
export const PARKED_LEVEL: WordKnowledgeLevel = 5

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type CefrLevel = (typeof CEFR_LEVELS)[number]

export const POS_VALUES = ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'preposition', 'phrasal verb', 'other'] as const
export type PosValue = (typeof POS_VALUES)[number]

export type CompletenessFilter = 'all' | 'complete' | 'incomplete'

export const LEVEL_LABELS: Record<number, string> = {
  1: 'Weak', 2: 'Basic', 3: 'Okay', 4: 'Strong', 5: 'Parked',
}

export const LEVEL_TIPS: Record<number, string> = {
  0: 'Unset — not yet rated',
  1: 'Level 1 — Weak: needs a lot of practice',
  2: 'Level 2 — Familiar: you recognize it but need more practice',
  3: 'Level 3 — Okay: you know it, review still helps',
  4: 'Level 4 — Strong: confident, rarely needs review',
  5: 'Parked — set aside for later',
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

const CEFR_ORDER: Record<string, number> = {A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6}
function cefrKey(level: string | null): number { return level ? (CEFR_ORDER[level] ?? 99) : 99 }

function isComplete(w: Word): boolean {
  return !!(w.definition && w.translation_entries.length > 0 && w.example_entries.length > 0 && w.part_of_speech)
}

export type FilterOptions = {
  search: string
  levelFilter: 'all' | WordKnowledgeLevel
  posFilter: PosValue | null
  cefrFilter: CefrLevel | null
  completeness: CompletenessFilter
  sortBy: SortOption
  frozenIds: number[] | null
}

export function filterAndSort(
  words: Word[],
  opts: FilterOptions,
): Word[] {
  const {search, levelFilter, posFilter, cefrFilter, completeness, sortBy, frozenIds} = opts
  const needle = search.toLowerCase().trim()
  const frozenSet = frozenIds ? new Set(frozenIds) : null

  const result = words.filter((w) => {
    if (levelFilter !== 'all' && w.knowledge_level !== levelFilter && !frozenSet?.has(w.id)) return false
    if (posFilter && w.part_of_speech !== posFilter && !frozenSet?.has(w.id)) return false
    if (cefrFilter && w.cefr_level !== cefrFilter && !frozenSet?.has(w.id)) return false
    if (completeness === 'complete' && !isComplete(w)) return false
    if (completeness === 'incomplete' && isComplete(w)) return false
    if (!needle) return true
    return [w.term, w.translation_entries?.join(' '), w.part_of_speech, w.pattern, w.example_entries?.join(' '), w.notes, w.definition, w.verb_form?.past_simple, w.verb_form?.past_participle]
      .some((v) => v?.toLowerCase().trim().includes(needle))
  })

  result.sort((a, b) => {
    switch (sortBy) {
      case 'term-asc':   return a.term.localeCompare(b.term)
      case 'term-desc':  return b.term.localeCompare(a.term)
      case 'level-asc':  return sortKey(a.knowledge_level) - sortKey(b.knowledge_level)
      case 'level-desc': {
        const ka = sortKey(a.knowledge_level)
        const kb = sortKey(b.knowledge_level)
        const da = ka >= 98 ? ka : (5 - ka)
        const db = kb >= 98 ? kb : (5 - kb)
        return da - db
      }
      case 'cefr-asc':   return cefrKey(a.cefr_level) - cefrKey(b.cefr_level)
      case 'cefr-desc':  return cefrKey(b.cefr_level) - cefrKey(a.cefr_level)
      case 'newest':     return b.created_at.localeCompare(a.created_at)
      case 'oldest':     return a.created_at.localeCompare(b.created_at)
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
