import {request} from '@/shared/api/http'
import {createTopic} from '@/features/topics/api/topicsApi'
import type {Topic} from '@/features/topics/types/topicTypes'
import {redirectIfUnauthorized} from '@/features/auth/lib/redirectIfUnauthorized'

function normalizeTopicName(name: string): string {
  return name.trim().toLocaleLowerCase()
}

export async function translateTerm(term: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(term)}&langpair=en|ru`,
    )
    if (!response.ok) return null
    const data = await response.json()
    const text = data?.responseData?.translatedText
    return text && text.toLowerCase() !== term.toLowerCase() ? text : null
  } catch {
    return null
  }
}

export async function suggestTopic(term: string, translation: string): Promise<string | null> {
  try {
    const response = await request<{topic_name: string}>('/api/words/suggest-topic', {
      method: 'POST',
      body: JSON.stringify({term, translation}),
    })
    return response.topic_name ?? null
  } catch (error) {
    redirectIfUnauthorized(error)
    return null
  }
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
