import type {Word} from '@/features/words/types/wordTypes'
import type {Topic} from '@/features/topics/types/topicTypes'
import type {StudyQueue} from '@/features/smart-review/types/studyQueueTypes'

export type OfflineWord = Word & {deleted_via_topic_id?: number | null}
export type OfflineTopic = Topic & {deleted_at?: string | null}
export type Snapshot = {version: 1; words: OfflineWord[]; topics: OfflineTopic[]; public_config?: {trash_retention_days: number}}
export type Change = {
  id: string
  entity: 'word' | 'topic'
  action: 'create' | 'update' | 'delete' | 'restore'
  entity_id: number
  data: Record<string, unknown>
  before: Record<string, unknown>
  affected_words: OfflineWord[]
}
export type Replica = Snapshot & {
  savedAt: string
  nextId: number
  changes: Change[]
  revision?: string
  wordAliases?: Record<number, number>
  topicAliases?: Record<number, number>
  mix?: StudyQueue
  mixes?: Record<string, StudyQueue>
}
