import {parseOfflineBackup} from '../backup'
import {changeItem} from '../changes'
import type {Replica} from '../types'

const savedAt = '2026-11-28T10:00:00.000Z'

function exportedReplica(): Replica {
  const replica: Replica = {version: 1, words: [], topics: [], changes: [], nextId: -1, savedAt}
  changeItem(replica, 'topic', 'create', -1, {name: 'Travel'})
  changeItem(replica, 'word', 'create', -1, {term: 'ticket', topic_ids: [-1], knowledge_level: 1})
  changeItem(replica, 'word', 'update', -2, {knowledge_level: 3, progress_source: 'study_list'})
  return replica
}

function backup(value: unknown) {
  return new File([JSON.stringify(value, null, 2)], 'lexora-offline-2026-11-28.json', {type: 'application/json'})
}

it('restores a v1 export with pending edit IDs, original checks and temporary references intact', async () => {
  const original = exportedReplica()
  const restored = await parseOfflineBackup(backup(original))

  expect(restored.savedAt).toBe(savedAt)
  expect(restored.nextId).toBe(original.nextId)
  expect(restored.words).toEqual(original.words)
  expect(restored.topics).toEqual(original.topics)
  expect(restored.changes).toEqual(original.changes)
  expect(restored.changes[2].before).toMatchObject({id: -2, knowledge_level: 1, topic_ids: [-1]})
  expect(restored.changes[2].occurred_at).toBe(original.changes[2].occurred_at)
})

it('keeps legacy Daily Mix progress and aliases when rebuilding replica metadata', async () => {
  const original = exportedReplica()
  original.nextId = -5
  original.mix = {
    id: -3, generated_at: savedAt, expires_at: '2026-11-29T10:00:00.000Z', is_active: true,
    total_count: 1, completed_count: 1,
    items: [{id: -4, position: 0, word_id: -2, word: original.words[0], is_completed: true, completed_at: savedAt}],
  }
  original.mixReviewedAt = {[-2]: savedAt}
  original.wordAliases = {[-10]: 9}
  original.topicAliases = {[-11]: 10}
  original.revision = 'device-revision'
  original.revisions = {version: 1, word_hashes: {'9': 'a'.repeat(64)}, topic_hashes: {'10': 'b'.repeat(64)}}
  original.restorePaused = true

  const restored = await parseOfflineBackup(backup(original))

  expect(restored.mix).toEqual(original.mix)
  expect(restored.mixReviewedAt).toEqual(original.mixReviewedAt)
  expect(restored.wordAliases).toEqual(original.wordAliases)
  expect(restored.topicAliases).toEqual(original.topicAliases)
  expect(restored).not.toHaveProperty('revision')
  expect(restored).not.toHaveProperty('revisions')
  expect(restored).not.toHaveProperty('restorePaused')
})

it.each([
  ['a duplicate word ID', (replica: Replica) => replica.words.push({...replica.words[0]}), /invalid words or topics/],
  ['a colliding next ID', (replica: Replica) => { replica.nextId = -2 }, /invalid word or topic references/],
  ['a missing word topic', (replica: Replica) => { replica.words[0].topic_ids = [99] }, /invalid word or topic references/],
  ['a cyclic topic hierarchy', (replica: Replica) => { replica.topics[0].parent_topic_id = -1 }, /invalid words or topics/],
  ['a missing queued edit target', (replica: Replica) => { replica.changes[1].entity_id = -9 }, /invalid pending edits/],
  ['a duplicate queued edit receipt', (replica: Replica) => replica.changes.push({...replica.changes[0]}), /invalid pending edits/],
  ['an invalid alias', (replica: Replica) => { replica.wordAliases = {[-9]: -10} }, /invalid saved links/],
])('rejects a backup with %s', async (_description, modify, message) => {
  const original = exportedReplica()
  modify(original)
  await expect(parseOfflineBackup(backup(original))).rejects.toThrow(message)
})
