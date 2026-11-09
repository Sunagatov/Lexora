import type {Topic} from '@/features/topics/types/topicTypes'

/** Label a topic by its available ancestry without changing its identity. */
export function createTopicLabeler(topics: readonly Topic[]) {
  const byId = new Map(topics.map(topic => [topic.id, topic]))
  return (topic: Topic): string => {
    const names = [topic.name]
    const seen = new Set([topic.id])
    let parent = byId.get(topic.parent_topic_id ?? 0)
    while (parent && !seen.has(parent.id)) {
      seen.add(parent.id)
      names.unshift(parent.name)
      parent = byId.get(parent.parent_topic_id ?? 0)
    }
    return names.join(' / ')
  }
}
