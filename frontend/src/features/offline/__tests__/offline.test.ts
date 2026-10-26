import {changeItem, remapId} from '../changes'
import {listWords, sidebarStats} from '../collections'
import type {Replica} from '../types'

function fixture(): Replica {
  return {version: 1, savedAt: '2026-10-17', nextId: -1, changes: [], words: [], topics: []}
}
function setup() {
  const replica = fixture()
  changeItem(replica, 'topic', 'create', -1, {name: 'People'})
  changeItem(replica, 'word', 'create', -1, {term: 'patient', topic_ids: [-1], knowledge_level: 1, part_of_speech: 'adjective', cefr_level: 'A1', translation_entries: ['терпеливый', 'выдержанный']})
  return replica
}

it('creates a topic and word offline, then remaps dependent queued edits after sync', () => {
  const replica = setup()
  changeItem(replica, 'word', 'update', -2, {knowledge_level: 4})
  replica.changes.shift()
  remapId(replica, 'topic', -1, 100)
  expect(replica.words[0].topic_ids).toEqual([100])
  expect(replica.changes[0].data.topic_ids).toEqual([100])
  replica.changes.shift()
  remapId(replica, 'word', -2, 200)
  expect(replica.changes[0].entity_id).toBe(200)
  expect(replica.changes[0].before.id).toBe(200)
  expect(replica.wordAliases?.[-2]).toBe(200)
  // A form opened before syncing can still submit its temporary IDs.
  changeItem(replica, 'word', 'update', -2, {topic_ids: [-1], notes: 'saved'})
  expect(replica.words[0].notes).toBe('saved')
})

it('stores previous values independently from later edits for conflict detection', () => {
  const replica = setup()
  changeItem(replica, 'word', 'update', -2, {knowledge_level: 4})
  changeItem(replica, 'word', 'update', -2, {knowledge_level: 5})
  expect(replica.changes[2].before.knowledge_level).toBe(1)
  expect(replica.changes[3].before.knowledge_level).toBe(4)
  expect(replica.words[0].knowledge_level).toBe(5)
})

it('rejects duplicates in another topic or Trash before adding a sync operation', () => {
  const replica = setup()
  changeItem(replica, 'topic', 'create', -1, {name: 'Other'})
  const pending = replica.changes.length
  expect(() => changeItem(replica, 'word', 'create', -1, {term: ' PATIENT ', topic_ids: [-3], part_of_speech: 'adjective'})).toThrow('already exists in your library')
  expect(replica.changes).toHaveLength(pending)
  changeItem(replica, 'word', 'delete', -2)
  expect(() => changeItem(replica, 'word', 'create', -1, {term: 'patient', topic_ids: [-3], part_of_speech: 'adjective'})).toThrow('Trash')
  expect(replica.words).toHaveLength(1)
})

it('keeps different parts of speech separate and protects edits that would collide', () => {
  const replica = setup()
  changeItem(replica, 'word', 'create', -1, {term: 'patient', topic_ids: [-1], part_of_speech: 'noun'})
  expect(replica.words).toHaveLength(2)
  const noun = replica.words[1]
  expect(() => changeItem(replica, 'word', 'update', noun.id, {part_of_speech: 'adjective'})).toThrow('already exists')
  changeItem(replica, 'word', 'update', noun.id, {knowledge_level: 4, notes: 'Updated'})
  expect(noun.knowledge_level).toBe(4)
  expect(noun.notes).toBe('Updated')
})

it('allows rating existing same-spelling entries without revalidating their identities', () => {
  const replica = setup()
  replica.words.push({...structuredClone(replica.words[0]), id: 100})
  changeItem(replica, 'word', 'update', -2, {knowledge_level: 4})
  expect(replica.words[0].knowledge_level).toBe(4)
})

it('deletes/restores topics and exclusive words while retaining relationships and translations', () => {
  const replica = setup()
  changeItem(replica, 'topic', 'delete', -1, {})
  expect(replica.words[0].deleted_at).toBeTruthy()
  expect(replica.words[0].topic_ids).toEqual([-1])
  expect(replica.changes[2].affected_words[0].deleted_at).toBeNull()
  changeItem(replica, 'topic', 'restore', -1, {restore_words: true})
  expect(replica.words[0].deleted_at).toBeNull()
  expect(replica.words[0].translation_entries).toHaveLength(2)
})

it('rejects deleting parents, circular hierarchy and duplicate words without losing saved content', () => {
  const replica = setup()
  changeItem(replica, 'topic', 'create', -1, {name: 'Traits', parent_topic_id: -1})
  expect(() => changeItem(replica, 'topic', 'delete', -1)).toThrow('subtopics')
  expect(() => changeItem(replica, 'topic', 'update', -1, {parent_topic_id: -3})).toThrow('ancestor')
  expect(() => changeItem(replica, 'word', 'create', -1, {term: 'PATIENT', topic_ids: [-1]})).toThrow('already exists')
  expect(replica.words).toHaveLength(1)
})

it('combines knowledge, CEFR, POS, subtree and search filters and paginates offline', () => {
  const replica = setup()
  changeItem(replica, 'topic', 'create', -1, {name: 'Traits', parent_topic_id: -1})
  changeItem(replica, 'word', 'create', -1, {term: 'calm', topic_ids: [-3], knowledge_level: 1, part_of_speech: 'adjective', cefr_level: 'A1'})
  changeItem(replica, 'word', 'create', -1, {term: 'happy', topic_ids: [-1], knowledge_level: 4, part_of_speech: 'adjective', cefr_level: 'A1'})
  const params = new URLSearchParams('topic_id=-1&levels=1&cefr_levels=A1&positions=adjective&sort=level-asc&then_sort=cefr-asc&page_size=1')
  expect(listWords(replica, params).words[0].term).toBe('calm')
  expect(listWords(replica, params).total_pages).toBe(2)
  params.set('page', '2')
  expect(listWords(replica, params).words[0].term).toBe('patient')
  params.set('page', '1'); params.set('search', 'выдержанный')
  expect(listWords(replica, params).total).toBe(1)
})

it('uses the same topic progress formula and excludes parked words from that formula', () => {
  const replica = setup()
  changeItem(replica, 'word', 'update', -2, {knowledge_level: 3})
  changeItem(replica, 'word', 'create', -1, {term: 'parked', topic_ids: [-1], knowledge_level: 5})
  expect(sidebarStats(replica)).toMatchObject({total_words: 2, topic_counts: {'-1': 2}, topic_progress: {'-1': 67}})
})
