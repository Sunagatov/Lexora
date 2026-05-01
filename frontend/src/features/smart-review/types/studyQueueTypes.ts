import type {Word} from '@/features/words/types/wordTypes'

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
