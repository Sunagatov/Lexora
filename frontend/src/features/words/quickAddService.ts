import {request} from '../../shared/http'
import {createTopic} from '../topics/api'
import {slugify} from '../../shared/slugify'
import type {Topic} from '../../shared/http'

export async function translateTerm(term: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(term)}&langpair=en|ru`,
    )
    if (!res.ok) return null
    const data = await res.json()
    const text = data?.responseData?.translatedText
    return text && text.toLowerCase() !== term.toLowerCase() ? text : null
  } catch {
    return null
  }
}

export async function suggestTopic(term: string, translation: string): Promise<string | null> {
  try {
    const res = await request<{topic_name: string}>('/api/words/suggest-topic', {
      method: 'POST',
      body: JSON.stringify({term, translation}),
    })
    return res.topic_name ?? null
  } catch {
    return null
  }
}

export async function ensureInbox(
  topics: Topic[],
  onCreated: (id: number) => void,
): Promise<number | null> {
  const existing = topics.find((t) => t.name === 'Inbox')
  if (existing) return existing.id
  try {
    const created = await createTopic('Inbox')
    onCreated(created.id)
    return created.id
  } catch {
    return null
  }
}
