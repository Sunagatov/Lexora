import type {Topic} from '../../shared/types'
import type {SortMode} from './TopicSortMenu'

export const POS_NAMES = new Set([
  'adjectives', 'adverbs', 'nouns', 'verbs', 'phrases', 'prepositions', 'irregular verbs',
])

export const isPosGroup = (t: Topic) => POS_NAMES.has(t.name.toLowerCase().trim())

type Comparator = (a: Topic, b: Topic) => number

export function sortTopics(
  topics: Topic[],
  mode: SortMode,
  progress: Map<number, number>,
  counts: Map<number, number>,
): Topic[] {
  let cmp: Comparator | null = null

  switch (mode) {
    case 'weakest':
      cmp = (a, b) => (progress.get(a.id) ?? 0) - (progress.get(b.id) ?? 0)
      break
    case 'strongest':
      cmp = (a, b) => (progress.get(b.id) ?? 0) - (progress.get(a.id) ?? 0)
      break
    case 'largest':
      cmp = (a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0)
      break
    case 'az':
      cmp = (a, b) => a.name.localeCompare(b.name)
      break
    case 'za':
      cmp = (a, b) => b.name.localeCompare(a.name)
      break
    default:
      break
  }

  return cmp ? [...topics].sort(cmp) : [...topics]
}

export function weakCount(
  list: Topic[],
  progress: Map<number, number>,
  counts: Map<number, number>,
): number {
  return list.filter((t) => (progress.get(t.id) ?? 0) < 30 && (counts.get(t.id) ?? 0) > 0).length
}

export function buildSidebarGroups(
  topics: Topic[],
  needle: string,
  pinnedIds: number[],
  posSort: SortMode,
  topicsSort: SortMode,
  posCollapsed: boolean,
  topicsCollapsed: boolean,
  recentIdsProp: number[],
  progress: Map<number, number>,
  counts: Map<number, number>,
) {
  const pinnedIdSet = new Set(pinnedIds)

  const posTopics = sortTopics(
    topics.filter((t) => isPosGroup(t) && !pinnedIdSet.has(t.id) && (!needle || t.name.toLowerCase().includes(needle))),
    posSort, progress, counts,
  )
  const themeTopics = sortTopics(
    topics.filter((t) => !isPosGroup(t) && !pinnedIdSet.has(t.id) && (!needle || t.name.toLowerCase().includes(needle) || (t.description ?? '').toLowerCase().includes(needle))),
    topicsSort, progress, counts,
  )
  const pinnedTopics = pinnedIds
    .map((id) => topics.find((t) => t.id === id))
    .filter((t): t is Topic => !!t && (!needle || t.name.toLowerCase().includes(needle)))

  const expandedIds = new Set<number>()
  if (!posCollapsed) posTopics.forEach((t) => expandedIds.add(t.id))
  if (!topicsCollapsed) themeTopics.forEach((t) => expandedIds.add(t.id))
  const recentTopics = recentIdsProp
    .map((id) => topics.find((t) => t.id === id))
    .filter((t): t is Topic => !!t && !needle && !pinnedIds.includes(t.id) && !expandedIds.has(t.id))
    .slice(0, 4)

  return {posTopics, themeTopics, pinnedTopics, recentTopics}
}
