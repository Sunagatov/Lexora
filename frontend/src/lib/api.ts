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
  topic_id: number
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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })

  if (response.status === 401) {
    window.location.href = '/login'
    throw new Error('Not authenticated')
  }

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<T>
}

export function fetchHealth() {
  return request<{ status: string }>('/health')
}

export function login(password: string) {
  return request<{ ok: boolean }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
}

export function logout() {
  return request<{ ok: boolean }>('/auth/logout', { method: 'POST' })
}

export function fetchTopics() {
  return request<Topic[]>('/api/topics')
}

export function fetchWords(params: { topicId?: number; search?: string } = {}) {
  const searchParams = new URLSearchParams()

  if (params.topicId) {
    searchParams.set('topic_id', String(params.topicId))
  }

  if (params.search?.trim()) {
    searchParams.set('search', params.search.trim())
  }

  const query = searchParams.toString()

  return request<Word[]>(`/api/words${query ? `?${query}` : ''}`)
}

export function updateWordKnowledgeLevel(wordId: number, knowledgeLevel: WordKnowledgeLevel) {
  return request<Word>(`/api/words/${wordId}`, {
    method: 'PUT',
    body: JSON.stringify({
      knowledge_level: knowledgeLevel,
    }),
  })
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

export function fetchWord(wordId: number) {
  return request<Word>(`/api/words/${wordId}`)
}

export function updateWord(wordId: number, payload: Partial<Omit<Word, 'id' | 'created_at' | 'updated_at'>>) {
  return request<Word>(`/api/words/${wordId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function fetchSmartReview() {
  return request<StudyQueue>('/api/smart-review')
}

export function completeSmartReviewItem(itemId: number) {
  return request<StudyQueue>(`/api/smart-review/items/${itemId}/complete`, { method: 'POST' })
}