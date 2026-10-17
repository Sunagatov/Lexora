import {ApiError} from '@/shared/api/apiError'
import type {Change, OfflineWord, Replica} from './types'

const fail = (message: string): never => { throw new ApiError(400, message) }
const slugify = (name: string) => name.normalize('NFKD').replace(/[^\x20-\x7e]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 200)
const normalized = (term: string) => term.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()

function validateTopics(replica: Replica, ids: number[]) {
  if (!ids.length || ids.some(id => !replica.topics.some(t => t.id === id && !t.deleted_at))) fail('Select at least one available topic.')
}

function checkWord(replica: Replica, word: OfflineWord) {
  if (!word.term?.trim() || word.term.length > 255) fail('Enter a word (up to 255 characters).')
  if (!word.topic_ids.some(id => replica.topics.some(t => t.id === id && !t.deleted_at))) fail('Select at least one available topic.')
  if (word.knowledge_level !== null && ![1, 3, 4, 5].includes(word.knowledge_level)) fail('Choose a valid knowledge level.')
  if (replica.words.some(w => w.id !== word.id && !w.deleted_at && normalized(w.term) === normalized(word.term) && w.topic_ids.some(id => word.topic_ids.includes(id)))) fail('This word already exists in a selected topic.')
}

export function changeItem(replica: Replica, entity: Change['entity'], action: Change['action'], id: number, data: Record<string, unknown> = {}): unknown {
  data = structuredClone(data)
  if (Array.isArray(data.topic_ids)) data.topic_ids = data.topic_ids.map(id => replica.topicAliases?.[Number(id)] ?? Number(id))
  if (typeof data.parent_topic_id === 'number') data.parent_topic_id = replica.topicAliases?.[data.parent_topic_id] ?? data.parent_topic_id
  for (const field of ['translation_entries', 'example_entries', 'synonym_entries', 'antonym_entries', 'collocation_entries']) {
    if (Array.isArray(data[field])) {
      const seen = new Set<string>()
      data[field] = (data[field] as string[]).map(value => value.trim()).filter(value => {
        const key = value.toLowerCase()
        if (!value || seen.has(key)) return false
        seen.add(key); return true
      })
    }
  }
  const now = new Date().toISOString()
  const collection = entity === 'word' ? replica.words : replica.topics
  if (action === 'create') id = replica.nextId
  const aliases = entity === 'word' ? replica.wordAliases : replica.topicAliases
  id = aliases?.[id] ?? id
  const current = collection.find(item => item.id === id)
  if (action !== 'create' && !current) throw new ApiError(404, 'Item not found in the offline copy.')
  const change: Change = {id: crypto.randomUUID(), entity, action, entity_id: id, data: structuredClone(data), before: structuredClone(current ?? {}), affected_words: []}

  if (entity === 'word') {
    let word = replica.words.find(w => w.id === id)
    if (action === 'create') {
      id = replica.nextId--
      word = {
        id, term: '', topic_ids: [], language: 'en', definition: null, pronunciation_ipa: null,
        pronunciation_audio_url: null, image_url: null, part_of_speech: null, cefr_level: null,
        register: null, countability: null, frequency_rank: null, knowledge_level: null, pattern: null,
        notes: null, is_active: true, verb_form: null, translation_entries: [], example_entries: [],
        synonym_entries: [], antonym_entries: [], collocation_entries: [], confusable_entries: [],
        example_count: 0, example_target_count: 3, example_status: 'missing', needs_example_enrichment: true,
        created_at: now, updated_at: now, deleted_at: null,
        ...data,
      } as OfflineWord
      validateTopics(replica, word.topic_ids)
      checkWord(replica, word)
      replica.words.push(word)
      change.entity_id = id
    } else if (word) {
      if (action === 'update') {
        if (Array.isArray(data.topic_ids)) validateTopics(replica, data.topic_ids as number[])
        const updated = {...word, ...data, updated_at: now} as OfflineWord
        checkWord(replica, updated)
        Object.assign(word, updated)
      } else if (action === 'delete') {
        word.deleted_at = now
        word.deleted_via_topic_id = null
      } else {
        if (!word.topic_ids.some(topicId => replica.topics.some(t => t.id === topicId && !t.deleted_at))) fail('Restore a topic before restoring this word.')
        checkWord(replica, word)
        word.deleted_at = null
        word.deleted_via_topic_id = null
      }
    }
    if (!word) throw new Error('Word not found')
    word.example_count = word.example_entries.length
    word.example_status = word.example_count >= 3 ? 'complete' : word.example_count ? 'partial' : 'missing'
    word.needs_example_enrichment = word.example_count < 3
  } else {
    let topic = replica.topics.find(t => t.id === id)
    if (action === 'create' || action === 'update' || action === 'restore') {
      const name = String(data.name ?? topic?.name ?? '').trim()
      const parentId = (data.parent_topic_id === undefined ? topic?.parent_topic_id : data.parent_topic_id) as number | null
      if (!name || name.length > 200 || !slugify(name)) fail('Enter a valid topic name (up to 200 characters).')
      if (replica.topics.some(t => t.id !== id && !t.deleted_at && normalized(t.name) === normalized(name))) fail('A topic with this name already exists.')
      const slug = data.slug ? slugify(String(data.slug)) : name !== topic?.name || !topic ? slugify(name) : topic.slug
      if (replica.topics.some(t => t.id !== id && t.slug === slug)) fail('A topic with this address already exists.')
      const visited = new Set([id])
      let ancestor = parentId
      while (ancestor) {
        if (visited.has(ancestor)) fail('A topic cannot be its own ancestor.')
        visited.add(ancestor)
        const parent = replica.topics.find(t => t.id === ancestor && !t.deleted_at)
        if (!parent) fail('Select an available parent topic.')
        ancestor = parent!.parent_topic_id ?? null
      }
      if (action === 'create') {
        id = replica.nextId--
        topic = {id, name, slug, description: null, parent_topic_id: parentId ?? null, is_active: true, deleted_at: null, created_at: now, updated_at: now, ...data}
        replica.topics.push(topic)
        change.entity_id = id
      } else if (topic && action === 'update') Object.assign(topic, data, {name, slug, updated_at: now})
    }
    if (!topic) throw new Error('Topic not found')
    if (action === 'delete' || action === 'restore') {
      change.affected_words = structuredClone(replica.words.filter(w => w.topic_ids.includes(id)))
      if (action === 'delete') {
        if (replica.topics.some(t => t.parent_topic_id === id && !t.deleted_at)) fail('Move or delete subtopics first.')
        topic.deleted_at = now
        replica.words.filter(w => w.topic_ids.includes(id) && !w.deleted_at).forEach(w => {
          const hasOtherTopic = w.topic_ids.some(other => replica.topics.some(t => t.id === other && !t.deleted_at))
          if (data.delete_words || !hasOtherTopic) { w.deleted_at = now; w.deleted_via_topic_id = id }
        })
      } else {
        topic.deleted_at = null
        if (data.restore_words) replica.words.filter(w => w.deleted_via_topic_id === id && w.deleted_at).forEach(w => {
          checkWord(replica, w)
          w.deleted_at = null
          w.deleted_via_topic_id = null
        })
      }
    }
  }
  replica.changes.push(change)
  return action === 'delete' ? undefined : collection.find(item => item.id === id)
}

export function remapId(replica: Replica, entity: Change['entity'], temporary: number, actual: number) {
  if (temporary === actual) return
  const remap = (id: number) => id === temporary ? actual : id
  const remapWord = (word: OfflineWord) => {
    if (entity === 'word') word.id = remap(word.id)
    else {
      word.topic_ids = word.topic_ids.map(remap)
      if (word.deleted_via_topic_id) word.deleted_via_topic_id = remap(word.deleted_via_topic_id)
    }
  }
  replica.words.forEach(remapWord)
  if (replica.mix) replica.mix.items.forEach(item => {
    if (entity === 'word') item.word_id = remap(item.word_id)
    remapWord(item.word)
  })
  replica.topics.forEach(topic => {
    if (entity === 'topic') {
      topic.id = remap(topic.id)
      if (topic.parent_topic_id) topic.parent_topic_id = remap(topic.parent_topic_id)
    }
  })
  replica.changes.forEach(change => {
    if (change.entity === entity) {
      change.entity_id = remap(change.entity_id)
      if (typeof change.before.id === 'number') change.before.id = remap(change.before.id)
    }
    if (entity === 'topic') for (const value of [change.data, change.before]) {
      if (Array.isArray(value.topic_ids)) value.topic_ids = value.topic_ids.map(id => remap(Number(id)))
      if (typeof value.parent_topic_id === 'number') value.parent_topic_id = remap(value.parent_topic_id)
    }
    change.affected_words.forEach(remapWord)
  })
  const key = entity === 'word' ? 'wordAliases' : 'topicAliases'
  replica[key] = {...replica[key], [temporary]: actual}
}
