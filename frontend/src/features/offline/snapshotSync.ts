import {ApiError} from '@/shared/api/apiError'
import {networkRequest} from '@/shared/api/http'
import type {Change, Replica, Snapshot, SnapshotDelta} from './types'

export function fetchSnapshot() {
  return networkRequest<Snapshot>('/api/offline/snapshot?include_revisions=true&include_cursor=true', {
    headers: {'X-Lexora-All-Languages': 'true'},
    signal: AbortSignal.timeout(60_000),
  })
}

/** Force a canonical copy after an accepted edit, including canonical no-op edits. */
export function refreshAcceptedEdit(replica: Replica, change: Change, id: number) {
  if (id <= 0) return
  const words = new Set(replica.forceWordIds), topics = new Set(replica.forceTopicIds)
  const revisions = replica.revisions
  if (replica.cursor) (change.entity === 'word' ? words : topics).add(id)
  if (revisions) (change.entity === 'word' ? revisions.word_hashes : revisions.topic_hashes)[id] = ''
  for (const word of change.affected_words) {
    const serverId = replica.wordAliases?.[word.id] ?? word.id
    if (serverId <= 0) continue
    if (replica.cursor) words.add(serverId)
    if (revisions) revisions.word_hashes[serverId] = ''
  }
  if (replica.cursor) {
    replica.forceWordIds = [...words]
    replica.forceTopicIds = [...topics]
  }
}

function applyDelta<T extends {id: number}>(current: T[], changed: T[], removed: number[]) {
  if (!changed.length && !removed.length) return current
  const items = new Map(current.map(item => [item.id, item]))
  for (const id of removed) items.delete(id)
  for (const item of changed) items.set(item.id, item)
  return [...items.values()].sort((a, b) => a.id - b.id)
}

export async function fetchSnapshotUpdate(replica: Replica): Promise<Snapshot | SnapshotDelta> {
  if (replica.cursor?.version === 1) {
    try {
      const update = await networkRequest<SnapshotDelta>('/api/offline/cursor', {
        method: 'POST',
        body: JSON.stringify({cursor: replica.cursor, force_word_ids: replica.forceWordIds, force_topic_ids: replica.forceTopicIds}),
        signal: AbortSignal.timeout(30_000),
      })
      if (update.version === 1 && update.cursor?.version === 1) return update
    } catch (error) {
      if (!(error instanceof ApiError && [404, 405, 409, 413, 422].includes(error.status))) throw error
    }
    return fetchSnapshot()
  }
  if (replica.revisions?.version === 1) {
    try {
      const update = await networkRequest<SnapshotDelta>('/api/offline/delta?include_cursor=true', {
        method: 'POST',
        headers: {'X-Lexora-All-Languages': 'true'},
        body: JSON.stringify(replica.revisions),
        signal: AbortSignal.timeout(60_000),
      })
      if (update.version === 1 && update.revisions?.version === 1) return update
    } catch (error) {
      // A rolled-back server or unsupported inventory can still send a full snapshot.
      if (!(error instanceof ApiError && [404, 405, 413, 422].includes(error.status))) throw error
    }
  }
  return fetchSnapshot()
}

export function applySnapshotUpdate(replica: Replica, update: Snapshot | SnapshotDelta): Replica {
  if (update.version !== 1) throw new Error('Update Lexora before syncing the saved library.')
  const savedAt = new Date().toISOString()
  const syncState = {cursor: update.cursor, forceWordIds: undefined, forceTopicIds: undefined, savedAt}
  if (!('removed_word_ids' in update)) {
    return {...replica, ...update, ...syncState, revisions: update.revisions}
  }
  const words = applyDelta(replica.words, update.words, update.removed_word_ids)
  const topics = applyDelta(replica.topics, update.topics, update.removed_topic_ids)
  let revisions: Replica['revisions']
  if (!update.cursor && replica.revisions && update.revisions) {
    const wordHashes = {...replica.revisions.word_hashes, ...update.revisions.word_hashes}
    const topicHashes = {...replica.revisions.topic_hashes, ...update.revisions.topic_hashes}
    for (const id of update.removed_word_ids) delete wordHashes[id]
    for (const id of update.removed_topic_ids) delete topicHashes[id]
    revisions = {version: 1, word_hashes: wordHashes, topic_hashes: topicHashes}
  }
  return {...replica, words, topics, ...syncState, public_config: update.public_config, revisions}
}
