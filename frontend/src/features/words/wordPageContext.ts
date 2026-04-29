import type {Topic, Word} from '../../shared/types'

type WordTopicRef = Pick<Word, 'topic_ids'>

export function topicContainsWordThroughSubtree(
  candidateTopicId: number,
  wordTopicIds: number[],
  topics: Topic[],
): boolean {
  const topicsById = new Map(topics.map((topic) => [topic.id, topic]))

  for (const wordTopicId of wordTopicIds) {
    const seen = new Set<number>()
    let currentId: number | null = wordTopicId

    while (currentId !== null && !seen.has(currentId)) {
      if (currentId === candidateTopicId) return true
      seen.add(currentId)
      currentId = topicsById.get(currentId)?.parent_topic_id ?? null
    }
  }

  return false
}

export function resolveWordContextTopic(
  word: WordTopicRef,
  topics: Topic[],
  preferredSlug?: string,
): Topic | undefined {
  if (!word.topic_ids.length) return undefined

  if (preferredSlug) {
    const preferred = topics.find(
      (t) => t.slug === preferredSlug && topicContainsWordThroughSubtree(t.id, word.topic_ids, topics),
    )
    if (preferred) return preferred
  }

  return topics.find((t) => word.topic_ids.includes(t.id))
}

export function buildWordLocationState(
  word: WordTopicRef,
  topics: Topic[],
  preferredSlug?: string,
): {fromTopicSlug: string} | undefined {
  const topic = resolveWordContextTopic(word, topics, preferredSlug)
  return topic ? {fromTopicSlug: topic.slug} : undefined
}
