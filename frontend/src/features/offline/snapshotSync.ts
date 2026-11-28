import {ApiError} from '@/shared/api/apiError'
import {networkRequest} from '@/shared/api/http'
import type {Change, Replica, Snapshot, SnapshotDelta} from './types'

export function fetchSnapshot() {
  return networkRequest<Snapshot>('/api/offline/snapshot?include_revisions=true', {
    headers: {'X-Lexora-All-Languages': 'true'},
    signal: AbortSignal.timeout(60_000),
  })
}

/** Force a canonical copy after an accepted edit, including canonical no-op edits. */
export function refreshAcceptedEdit(replica: Replica, change: Change, id: number) {
  const revisions = replica.revisions
  if (!revisions || id <= 0) return
  const hashes = change.entity === 'word' ? revisions.word_hashes : revisions.topic_hashes
  hashes[id] = ''
  for (const word of change.affected_words) {
    const serverId = replica.wordAliases?.[word.id] ?? word.id
    if (serverId > 0) revisions.word_hashes[serverId] = ''
  }
}

function applyDelta<T extends {id: number}>(
  current: T[], changed: T[], removed: number[], hashes: Record<string, string>, revised: Record<string, string>,
) {
  const items = new Map(current.map(item => [item.id, item]))
  const nextHashes = {...hashes, ...revised}
  for (const id of removed) {
    items.delete(id)
    delete nextHashes[id]
  }
  for (const item of changed) items.set(item.id, item)
  return {items: [...items.values()].sort((a, b) => a.id - b.id), hashes: nextHashes}
}

export async function fetchSnapshotUpdate(replica: Replica): Promise<Snapshot | SnapshotDelta> {
  if (replica.revisions?.version === 1) {
    try {
      const update = await networkRequest<SnapshotDelta>('/api/offline/delta', {
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
  if (!('removed_word_ids' in update) || !replica.revisions) {
    return {...replica, ...update, revisions: update.revisions, savedAt}
  }
  const words = applyDelta(replica.words, update.words, update.removed_word_ids,
    replica.revisions.word_hashes, update.revisions.word_hashes)
  const topics = applyDelta(replica.topics, update.topics, update.removed_topic_ids,
    replica.revisions.topic_hashes, update.revisions.topic_hashes)
  return {...replica, words: words.items, topics: topics.items, savedAt, public_config: update.public_config,
    revisions: {version: 1, word_hashes: words.hashes, topic_hashes: topics.hashes}}
}
