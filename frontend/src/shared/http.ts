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

export type WordKnowledgeLevel = 1 | 2 | 3 | 4 | 5

export type Word = {
  id: number
  topic_ids: number[]
  term: string
  past_simple: string | null
  past_participle: string | null
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

export type StudyQueueItem = {
  id: number
  word_id: number
  position: number
  is_completed: boolean
  completed_at: string | null
  word: Word
}

export type StudyQueue = {
  id: number
  generated_at: string
  expires_at: string
  is_active: boolean
  total_count: number
  completed_count: number
  items: StudyQueueItem[]
}

export type TrashWord  = Word  & {deleted_at: string}
export type TrashTopic = Topic & {deleted_at: string}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  const response = await fetch(`${API_BASE_URL}${path}`, {...init, headers, credentials: 'include'})

  if (response.status === 401) {
    window.location.href = '/login'
    throw new Error('Not authenticated')
  }
  if (!response.ok) throw new Error(`Request failed: ${response.status} ${response.statusText}`)

  // 204 No Content and 205 Reset Content have no body — return undefined cast to T
  if (response.status === 204 || response.status === 205) return undefined as unknown as T

  return response.json() as Promise<T>
}
