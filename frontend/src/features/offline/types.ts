import type {Word} from '@/features/words/types/wordTypes'
import type {Topic} from '@/features/topics/types/topicTypes'
import type {StudyQueue} from '@/features/smart-review/types/studyQueueTypes'
import type {RecallAttempt} from '@/features/stats/model/recallHistory'

export type OfflineWord = Word & {deleted_via_topic_id?: number | null}
export type OfflineTopic = Topic & {deleted_at?: string | null}
export type SnapshotRevisions = {
  version: 1
  word_hashes: Record<string, string>
  topic_hashes: Record<string, string>
}
export type CatalogCursor = {version: 1; epoch: string; revision: string}
export type Snapshot = {
  version: 1
  words: OfflineWord[]
  topics: OfflineTopic[]
  public_config?: {trash_retention_days: number}
  revisions?: SnapshotRevisions
  cursor?: CatalogCursor
}
export type SnapshotDelta = Snapshot & {
  removed_word_ids: number[]
  removed_topic_ids: number[]
}
export type Change = {
  id: string
  occurred_at?: string
  entity: 'word' | 'topic'
  action: 'create' | 'update' | 'delete' | 'restore'
  entity_id: number
  data: Record<string, unknown>
  before: Record<string, unknown>
  affected_words: OfflineWord[]
}
export type OfflineConflict = {
  changeId: string
  entity: 'word' | 'topic'
  label: string
  fields: {field: string; before: unknown; device: unknown; server: unknown}[]
}
export type BlockedChange = {
  message: string
  missingLocalDependency?: boolean
  serverItem?: Record<string, unknown>
  conflict?: OfflineConflict
}
export type Replica = Snapshot & {
  savedAt: string
  nextId: number
  changes: Change[]
  revision?: string
  restorePaused?: boolean
  forceWordIds?: number[]
  forceTopicIds?: number[]
  blockedChanges?: Record<string, BlockedChange>
  refreshPending?: boolean
  wordAliases?: Record<number, number>
  topicAliases?: Record<number, number>
  mix?: StudyQueue
  mixes?: Record<string, StudyQueue>
  mixReviewedAt?: Record<number, string>
}
export type OfflineBackup = Replica & {recallAttempts?: RecallAttempt[]}
