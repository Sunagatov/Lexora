import type {Topic} from '@/shared/types'
import type {SortMode} from '@/features/topics/model/topicSort'

export const POS_NAMES = new Set([
  'adjectives', 'adverbs', 'nouns', 'verbs', 'phrases', 'prepositions', 'irregular verbs',
])

export const isPosGroup = (t: Topic) => POS_NAMES.has(t.name.toLowerCase().trim())

type Comparator = (a: Topic, b: Topic) => number

export type TopicTreeNode = {
  topic: Topic
  children: TopicTreeNode[]
}

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

function matchesNeedle(topic: Topic, needle: string): boolean {
  if (!needle) return true
  const name = topic.name.toLowerCase()
  const description = (topic.description ?? '').toLowerCase()
  return name.includes(needle) || description.includes(needle)
}

function buildTopicTree(
  topics: Topic[],
  needle: string,
  sortMode: SortMode,
  progress: Map<number, number>,
  counts: Map<number, number>,
): TopicTreeNode[] {
  const structural = topics.filter((t) => !isPosGroup(t))
  const structuralById = new Map(structural.map((topic) => [topic.id, topic]))
  const childrenByParent = new Map<number | null, Topic[]>()

  for (const topic of structural) {
    const parentId = topic.parent_topic_id ?? null
    const parentExists = parentId !== null && structuralById.has(parentId)
    const key = parentExists ? parentId : null
    const list = childrenByParent.get(key) ?? []
    list.push(topic)
    childrenByParent.set(key, list)
  }

  const build = (parentId: number | null): TopicTreeNode[] => {
    const siblings = sortTopics(childrenByParent.get(parentId) ?? [], sortMode, progress, counts)
    return siblings.flatMap((topic) => {
      const children = build(topic.id)
      if (!needle) return [{topic, children}]
      if (matchesNeedle(topic, needle) || children.length > 0) return [{topic, children}]
      return []
    })
  }

  return build(null)
}

function flattenTopicTree(nodes: TopicTreeNode[]): Topic[] {
  const flat: Topic[] = []
  for (const node of nodes) {
    flat.push(node.topic)
    flat.push(...flattenTopicTree(node.children))
  }
  return flat
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
  const pinnedTopics = pinnedIds
    .map((id) => topics.find((t) => t.id === id))
    .filter((t): t is Topic => !!t && (!needle || t.name.toLowerCase().includes(needle)))
  const themeTree = buildTopicTree(topics, needle, topicsSort, progress, counts)
  const themeTopics = flattenTopicTree(themeTree)

  const expandedIds = new Set<number>()
  if (!posCollapsed) posTopics.forEach((t) => expandedIds.add(t.id))
  if (!topicsCollapsed) themeTopics.forEach((t) => expandedIds.add(t.id))
  const recentTopics = recentIdsProp
    .map((id) => topics.find((t) => t.id === id))
    .filter((t): t is Topic => !!t && !needle && !pinnedIds.includes(t.id) && !expandedIds.has(t.id))
    .slice(0, 4)

  return {posTopics, themeTopics, themeTree, pinnedTopics, recentTopics}
}
