import {createTopic} from '@/features/topics/api/topicsApi'
import type {Topic} from '@/features/topics/types/topicTypes'
import {redirectIfUnauthorized} from '@/features/auth/lib/redirectIfUnauthorized'

function normalizeTopicName(name: string): string {
  return name.trim().toLocaleLowerCase()
}

export async function ensureInboxTopic(
  topics: Topic[],
  onCreated: (id: number) => void,
): Promise<number | null> {
  const existing = topics.find((topic) => normalizeTopicName(topic.name) === 'inbox')
  if (existing) return existing.id

  try {
    const created = await createTopic('Inbox')
    onCreated(created.id)
    return created.id
  } catch (error) {
    redirectIfUnauthorized(error)
    return null
  }
}

export function findTopicByName(topics: Topic[], name: string): Topic | undefined {
  const normalizedName = normalizeTopicName(name)
  return topics.find((topic) => normalizeTopicName(topic.name) === normalizedName)
}
