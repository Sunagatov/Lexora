import type {StudyQueue} from '@/features/smart-review/types/studyQueueTypes'
import {LEARNING_LANGUAGES} from '@/features/languages/api'
import type {RecallAttempt} from '@/features/stats/model/recallHistory'
import type {Change, OfflineBackup, OfflineTopic, OfflineWord, Replica} from './types'

const MAX_BACKUP_BYTES = 128 * 1024 * 1024
const unsafeKeys = ['__proto__', 'constructor', 'prototype']
const wordLists = ['translation_entries', 'example_entries', 'synonym_entries', 'antonym_entries', 'collocation_entries']
const wordText = [
  'transliteration', 'definition', 'pronunciation_ipa', 'pronunciation_easy', 'pronunciation_note_ru',
  'pronunciation_audio_url', 'image_url', 'part_of_speech', 'cefr_level', 'register', 'countability',
  'pattern', 'notes',
]
const verbFields = ['past_simple', 'past_participle', 'present_participle', 'third_person']
const changeFields = new Set(['id', 'occurred_at', 'entity', 'action', 'entity_id', 'data', 'before', 'affected_words'])

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && unsafeKeys.every((key) => !Object.prototype.hasOwnProperty.call(value, key))
}

function id(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value !== 0
}

function count(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function date(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function nullableText(value: unknown): boolean {
  return value == null || typeof value === 'string'
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function distinct<T>(values: T[]): boolean {
  return new Set(values).size === values.length
}

function word(value: unknown): value is OfflineWord {
  return record(value) && id(value.id) && text(value.term) && (value.language === undefined || text(value.language))
    && Array.isArray(value.topic_ids) && value.topic_ids.every(id) && distinct(value.topic_ids)
    && (value.deleted_via_topic_id == null || id(value.deleted_via_topic_id))
    && (value.deleted_at == null || date(value.deleted_at)) && date(value.created_at) && date(value.updated_at)
    && typeof value.is_active === 'boolean' && (value.is_favorite === undefined || typeof value.is_favorite === 'boolean')
    && (value.knowledge_level === null || (typeof value.knowledge_level === 'number'
      && [1, 2, 3, 4, 5].includes(value.knowledge_level)))
    && (value.frequency_rank == null || (id(value.frequency_rank) && value.frequency_rank > 0))
    && wordText.every((field) => nullableText(value[field])) && wordLists.every((field) => strings(value[field]))
    && Array.isArray(value.confusable_entries)
    && value.confusable_entries.every((item) => record(item) && text(item.value) && nullableText(item.explanation))
    && (value.verb_form == null || (record(value.verb_form)
      && verbFields.every((field) => nullableText((value.verb_form as Record<string, unknown>)[field]))))
    && (value.translation_language === undefined || value.translation_language === 'en' || value.translation_language === 'ru')
    && (value.translation_groups === undefined || (record(value.translation_groups)
      && Object.values(value.translation_groups).every(strings)))
    && (value.explanation_groups === undefined || (record(value.explanation_groups)
      && Object.values(value.explanation_groups).every((group) =>
        record(group) && nullableText(group.definition) && nullableText(group.notes))))
    && count(value.example_count) && count(value.example_target_count) && typeof value.needs_example_enrichment === 'boolean'
    && (value.example_status === 'missing' || value.example_status === 'partial' || value.example_status === 'complete')
}

function topic(value: unknown): value is OfflineTopic {
  return record(value) && id(value.id) && text(value.name) && text(value.slug)
    && (value.language === undefined || text(value.language)) && nullableText(value.description)
    && (value.parent_topic_id == null || id(value.parent_topic_id))
    && typeof value.is_active === 'boolean' && (value.deleted_at == null || date(value.deleted_at))
    && date(value.created_at) && date(value.updated_at)
}

// Restored edits are eventually sent as written. Preserve their request payload and receipt ID.
function safeJsonRecord(value: unknown): value is Record<string, unknown> {
  if (!record(value)) return false
  const pending: unknown[] = Object.values(value)
  while (pending.length) {
    const entry = pending.pop()
    if (!entry || typeof entry !== 'object') continue
    if (!Array.isArray(entry) && !record(entry)) return false
    for (const child of Object.values(entry)) pending.push(child)
  }
  return true
}

function change(value: unknown): value is Change {
  return record(value) && typeof value.id === 'string'
    && Object.keys(value).every((key) => changeFields.has(key))
    && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value.id)
    && (value.entity === 'word' || value.entity === 'topic') && id(value.entity_id)
    && (value.action === 'create' || value.action === 'update' || value.action === 'delete' || value.action === 'restore')
    && (value.occurred_at === undefined || (date(value.occurred_at) && /(?:Z|[+-]\d{2}:\d{2})$/i.test(value.occurred_at)))
    && safeJsonRecord(value.data) && safeJsonRecord(value.before)
    && (value.data.language === undefined || text(value.data.language))
    && (value.before.language === undefined || text(value.before.language))
    && (value.action === 'create' ? value.entity_id < 0 : value.before.id === value.entity_id)
    && Array.isArray(value.affected_words) && value.affected_words.every(word)
    && distinct(value.affected_words.map((entry) => entry.id))
}

function mix(value: unknown): value is StudyQueue {
  return record(value) && id(value.id) && date(value.generated_at) && date(value.expires_at)
    && typeof value.is_active === 'boolean' && count(value.total_count) && count(value.completed_count)
    && Array.isArray(value.items) && value.items.every((item) =>
      record(item) && id(item.id) && id(item.word_id) && count(item.position)
      && typeof item.is_completed === 'boolean' && (item.completed_at === null || date(item.completed_at))
      && word(item.word) && item.word.id === item.word_id)
    && distinct(value.items.map((item) => item.id))
}

function aliases(value: unknown): value is Record<number, number> | undefined {
  return value === undefined || (record(value) && Object.entries(value).every(([key, target]) =>
    /^-[1-9]\d*$/.test(key) && id(Number(key)) && id(target) && target > 0))
}

function topicTree(topics: OfflineTopic[]): boolean {
  const parents = new Map(topics.map((entry) => [entry.id, entry.parent_topic_id ?? null]))
  const checked = new Set<number>()
  for (const entry of topics) {
    const path = new Set<number>()
    let cursor: number | null = entry.id
    while (cursor !== null && !checked.has(cursor)) {
      const parent = parents.get(cursor)
      if (path.has(cursor) || parent === undefined) return false
      path.add(cursor)
      cursor = parent
    }
    for (const seen of path) checked.add(seen)
  }
  return true
}

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reader.onabort = () => reject(new Error('Could not read the backup file.'))
    reader.readAsText(file)
  })
}

function pendingRecall(value: unknown): value is RecallAttempt & {id: string} {
  return record(value) && typeof value.id === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value.id) &&
    id(value.wordId) && value.wordId > 0 && date(value.occurredAt) && /(?:Z|[+-]\d{2}:\d{2})$/i.test(value.occurredAt) &&
    typeof value.recalled === 'boolean' && !value.uploaded && LEARNING_LANGUAGES.some(item => item.code === value.language) &&
    (value.translationLanguage === 'en' || value.translationLanguage === 'ru')
}

export async function parseOfflineBackup(file: File): Promise<OfflineBackup> {
  if (file.size > MAX_BACKUP_BYTES) throw new Error('Choose a backup file smaller than 128 MB.')
  const source = await readText(file)
  let value: unknown
  try {
    value = JSON.parse(source.replace(/^\uFEFF/, ''))
  } catch {
    throw new Error('This file could not be read as a Lexora JSON backup.')
  }
  if (!record(value) || value.version !== 1 || !date(value.savedAt) || !id(value.nextId) || value.nextId >= 0
    || !Array.isArray(value.words) || !Array.isArray(value.topics) || !Array.isArray(value.changes)) {
    throw new Error('Choose a version 1 offline backup exported from Lexora.')
  }
  const {words, topics, changes, nextId, savedAt, public_config, wordAliases, topicAliases, mix: legacyMix, mixes, mixReviewedAt, recallAttempts} = value
  if (!words.every(word) || !topics.every(topic) || !distinct(words.map((entry) => entry.id))
    || !distinct(topics.map((entry) => entry.id)) || !topicTree(topics)) {
    throw new Error('The backup contains invalid words or topics.')
  }
  const topicIds = new Set(topics.map((entry) => entry.id))
  const wordIds = new Set(words.map((entry) => entry.id))
  if (words.some((entry) => entry.topic_ids.some((topicId) => !topicIds.has(topicId)))
    || [...wordIds, ...topicIds].some((entryId) => entryId <= nextId)) {
    throw new Error('The backup contains invalid word or topic references.')
  }
  if (!changes.every(change) || !distinct(changes.map((entry) => entry.id.toLowerCase()))
    || changes.some((entry) => !(entry.entity === 'word' ? wordIds : topicIds).has(entry.entity_id))) {
    throw new Error('The backup contains invalid pending edits.')
  }
  if (!aliases(wordAliases) || !aliases(topicAliases)) throw new Error('The backup contains invalid saved links.')
  if ((legacyMix !== undefined && !mix(legacyMix))
    || (mixes !== undefined && (!record(mixes) || !Object.values(mixes).every(mix)))
    || (mixReviewedAt !== undefined && (!record(mixReviewedAt)
      || !Object.entries(mixReviewedAt).every(([wordId, time]) => id(Number(wordId)) && date(time))))) {
    throw new Error('The backup contains invalid Daily Mix history.')
  }
  if (public_config !== undefined && (!record(public_config) || !count(public_config.trash_retention_days))) {
    throw new Error('The backup contains invalid offline settings.')
  }
  const queues = [...Object.values((mixes ?? {}) as Record<string, StudyQueue>), ...(legacyMix ? [legacyMix] : [])]
  if (queues.some((queue) => queue.id <= nextId || queue.items.some((item) => item.id <= nextId))) {
    throw new Error('The backup contains invalid Daily Mix references.')
  }
  if (recallAttempts !== undefined && (!Array.isArray(recallAttempts) || !recallAttempts.every(pendingRecall) ||
    !distinct(recallAttempts.map(attempt => attempt.id.toLowerCase())))) {
    throw new Error('The backup contains invalid recall attempts.')
  }

  return {
    // Re-establish local storage and server revision metadata when the owner restores the backup.
    version: 1, savedAt, nextId, words, topics, changes, wordAliases, topicAliases, mix: legacyMix,
    mixes: mixes as Replica['mixes'], mixReviewedAt: mixReviewedAt as Replica['mixReviewedAt'],
    public_config: public_config as Replica['public_config'],
    recallAttempts: recallAttempts?.map(({id, wordId, occurredAt, recalled, language, translationLanguage}) =>
      ({id: id.toLowerCase(), wordId, occurredAt, recalled, language, translationLanguage})),
  }
}
