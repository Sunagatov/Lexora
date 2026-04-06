const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export type Topic = {
  id: number
  name: string
  slug: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Word = {
  id: number
  topic_id: number
  term: string
  translations: string
  part_of_speech: string | null
  knowledge_level: number | null
  countability: string | null
  pattern: string | null
  example: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<T>
}

export function fetchHealth() {
  return request<{ status: string }>('/health')
}

export function fetchTopics() {
  return request<Topic[]>('/api/topics')
}

export function fetchWords() {
  return request<Word[]>('/api/words')
}