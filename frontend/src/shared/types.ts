export type WordKnowledgeLevel = 1 | 2 | 3 | 4 | 5

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
  topic_ids: number[]
  term: string
  past_simple: string | null
  past_participle: string | null
  translations: string
  part_of_speech: string | null
  knowledge_level: WordKnowledgeLevel | null
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
