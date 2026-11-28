import {ApiError} from '@/shared/api/apiError'
import {networkRequest} from '@/shared/api/http'
import type {BlockedChange, Change, OfflineConflict, OfflineWord, Replica} from './types'

const PER_REQUEST = 24
const REJECTED = [400, 404, 409, 422]
type Upload = {change_id: string; status: number; result?: {entity_id: number}; detail?: unknown}

const keyOf = (change: Change) => `${change.entity}:${change.entity_id}`
const languageOf = (change: Change) => String(change.data.language ?? change.before.language ?? 'en')
const batchable = (change: Change) => change.entity === 'word' && change.action === 'update' && change.entity_id > 0

function writes(change: Change) {
  return [keyOf(change), ...change.affected_words.map(word => `word:${word.id}`)]
}

function dependencies(change: Change) {
  const topics = [change.before.topic_ids, change.data.topic_ids].flatMap(value => Array.isArray(value) ? value : [])
  for (const id of [change.before.parent_topic_id, change.data.parent_topic_id]) {
    if (typeof id === 'number') topics.push(id)
  }
  return [...writes(change), ...topics.map(id => `topic:${id}`)]
}

export function chooseUploads(replica: Replica, attempted: ReadonlySet<string>, retryBlocked: boolean) {
  const unavailable = new Set<string>()
  const selected: Change[] = []
  for (const change of replica.changes) {
    const issue = replica.blockedChanges?.[change.id]
    const blocked = issue && (issue.missingLocalDependency || !retryBlocked || attempted.has(change.id))
    if (blocked || dependencies(change).some(item => unavailable.has(item))) {
      for (const item of writes(change)) unavailable.add(item)
      continue
    }
    if (selected.length && (!batchable(change) || languageOf(change) !== languageOf(selected[0]) ||
      selected.some(item => item.entity_id === change.entity_id))) break
    selected.push(change)
    if (!batchable(change) || selected.length === PER_REQUEST) break
  }
  return selected
}

function headers(change: Change) {
  return {'X-Lexora-Language': languageOf(change), 'X-Lexora-Conflict-Details': 'true'}
}

export function isRejected(status: number) { return REJECTED.includes(status) }

export async function uploadChanges(changes: Change[]): Promise<Upload[]> {
  if (changes.length === 1) {
    const [change] = changes
    try {
      const result = await networkRequest<{entity_id: number}>('/api/offline/changes', {
        method: 'POST', headers: headers(change), body: JSON.stringify(change), signal: AbortSignal.timeout(20_000),
      })
      return [{change_id: change.id, status: 200, result}]
    } catch (error) {
      if (!(error instanceof ApiError) || !isRejected(error.status)) throw error
      return [{change_id: change.id, status: error.status, detail: error.detail ?? error.message}]
    }
  }
  const {results} = await networkRequest<{results: Upload[]}>('/api/offline/changes/batch', {
    method: 'POST', headers: headers(changes[0]), body: JSON.stringify({changes}), signal: AbortSignal.timeout(60_000),
  })
  if (!Array.isArray(results) || results.length !== changes.length ||
    results.some((result, i) => result.change_id !== changes[i].id || (result.status !== 200 && !isRejected(result.status)))) {
    throw new Error('Lexora could not verify the upload response. Your edits are saved on this device.')
  }
  return results
}

export function describeRejected(change: Change, detail: unknown): BlockedChange {
  const info = detail && typeof detail === 'object' ? detail as {
    message?: string; code?: string; change_id?: string; server_item?: Record<string, unknown>; fields?: OfflineConflict['fields']
  } : undefined
  const message = typeof detail === 'string' ? detail :
    info?.message ?? 'The server rejected this edit. Your changes are saved on this device.'
  if (change.action !== 'update' || info?.code !== 'offline_edit_conflict' || info.change_id !== change.id ||
    info.server_item?.id !== change.entity_id || !Array.isArray(info.fields) || !info.fields.length) return {message}
  return {message, serverItem: info.server_item, conflict: {
    changeId: change.id, entity: change.entity, label: changeLabel(change, info.server_item), fields: info.fields,
  }}
}

export function changeLabel(change: Change, current = change.before) {
  const field = change.entity === 'word' ? 'term' : 'name'
  return String(current[field] ?? change.data[field] ?? `${change.entity === 'word' ? 'Word' : 'Topic'} ${change.entity_id}`)
}

/** Restore the selected base and retain optimistic fields from later edits to these rows. */
export function undoRejected(replica: Replica, change: Change, later: Change[], base?: Record<string, unknown>) {
  function restoreRow(entity: Change['entity'], id: number, before?: Record<string, unknown>) {
    const collection = entity === 'word' ? replica.words : replica.topics
    const current = collection.find(row => row.id === id)
    const following = later.filter(edit => writes(edit).includes(`${entity}:${id}`))
    if (!before) {
      if (current && (following.length || later.some(edit => dependencies(edit).includes(`${entity}:${id}`)))) {
        current.deleted_at = new Date().toISOString()
      } else if (entity === 'word') replica.words = replica.words.filter(word => word.id !== id)
      else replica.topics = replica.topics.filter(topic => topic.id !== id)
      return
    }
    if (!current) return
    const fields = new Set<string>()
    const translationTargets = new Set<string>()
    const explanationTargets = new Map<string, Set<'definition' | 'notes'>>()
    for (const edit of following) {
      if (edit.action === 'delete' || edit.action === 'restore') {
        fields.add('deleted_at')
        if (entity === 'word') fields.add('deleted_via_topic_id')
      }
      if (edit.entity !== entity || edit.entity_id !== id) continue
      const target = edit.data.translation_language === 'en' ? 'en' : 'ru'
      for (const field of Object.keys(edit.data)) {
        if (target === 'ru' || !['translation_entries', 'definition', 'notes'].includes(field)) fields.add(field)
      }
      if ('translation_entries' in edit.data) translationTargets.add(target)
      for (const field of ['definition', 'notes'] as const) {
        if (!(field in edit.data)) continue
        if (!explanationTargets.has(target)) explanationTargets.set(target, new Set())
        explanationTargets.get(target)!.add(field)
      }
      if ('example_entries' in edit.data) {
        fields.add('example_count'); fields.add('example_status'); fields.add('needs_example_enrichment')
      }
      if ('term' in edit.data) {fields.add('pronunciation_easy'); fields.add('pronunciation_note_ru')}
      if ('name' in edit.data) fields.add('slug')
    }
    const restored = Object.fromEntries(Object.entries(before).filter(([field]) =>
      !fields.has(field) && field !== 'translation_groups' && field !== 'explanation_groups'))
    if (entity === 'word') {
      const word = current as OfflineWord
      const baseWord = before as Partial<OfflineWord>
      if (baseWord.translation_groups || word.translation_groups || translationTargets.size) {
        const groups = {...(baseWord.translation_groups ?? {ru: baseWord.translation_entries ?? []})}
        for (const target of translationTargets) groups[target] = word.translation_groups?.[target] ?? []
        restored.translation_groups = groups
      }
      if (baseWord.explanation_groups || word.explanation_groups || explanationTargets.size) {
        const groups = {...(baseWord.explanation_groups ?? {ru: {definition: baseWord.definition, notes: baseWord.notes}})}
        for (const [target, editedFields] of explanationTargets) {
          const group = {...groups[target]}
          for (const key of editedFields) group[key] = word.explanation_groups?.[target]?.[key] ?? null
          groups[target] = group
        }
        restored.explanation_groups = groups
      }
    }
    Object.assign(current, restored)
  }

  restoreRow(change.entity, change.entity_id, change.action === 'create' ? undefined : base ?? change.before)
  for (const word of change.affected_words) restoreRow('word', word.id, word)
  if (change.action === 'create') {
    for (const edit of later) {
      if (!dependencies(edit).includes(keyOf(change))) continue
      (replica.blockedChanges ??= {})[edit.id] = {
        message: 'This edit referred to a local item whose creation was discarded.',
        missingLocalDependency: true,
      }
    }
  }
  const referenced = new Set(replica.changes.flatMap(dependencies))
  const orphanTopics = new Set(replica.topics.filter(topic => topic.id < 0 && topic.deleted_at &&
    !referenced.has(`topic:${topic.id}`)).map(topic => topic.id))
  replica.topics = replica.topics.filter(topic => !orphanTopics.has(topic.id)).map(topic =>
    topic.parent_topic_id && orphanTopics.has(topic.parent_topic_id) ? {...topic, parent_topic_id: null} : topic)
  replica.words = replica.words.filter(word => word.id >= 0 || !word.deleted_at || referenced.has(`word:${word.id}`)).map(word =>
    word.topic_ids.some(id => orphanTopics.has(id)) ? {...word, topic_ids: word.topic_ids.filter(id => !orphanTopics.has(id))} : word)
}
