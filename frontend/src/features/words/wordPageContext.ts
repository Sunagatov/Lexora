import type {Topic, Word} from '../../shared/types'

type WordTopicRef = Pick<Word, 'topic_ids'>

export function resolveWordContextTopic(
  word: WordTopicRef,
  topics: Topic[],
  preferredSlug?: string,
): Topic | undefined {
  if (!word.topic_ids.length) return undefined

  if (preferredSlug) {
    const preferred = topics.find(
      (t) => t.slug === preferredSlug && word.topic_ids.includes(t.id),
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
