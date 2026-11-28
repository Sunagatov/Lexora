import type {Replica} from './types'
import type {RecallAttempt} from '@/features/stats/model/recallHistory'

const DATABASE = 'lexora-offline-v1'
const MIX_PROGRESS = 'mix-progress'
export const RECALL_HISTORY_KEY = 'recall-history-v1'
const RECALL_RESTORE_PAUSED = 'recall-restore-paused'
type MixProgress = {completed: number; total: number}
type MixProgressByLanguage = Record<string, MixProgress>
let database: Promise<IDBDatabase> | undefined

function open() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => request.result.createObjectStore('data')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return database
}

export async function readReplica(): Promise<Replica | undefined> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('data', 'readonly')
    const store = tx.objectStore('data')
    const replica = store.get('replica')
    const mix = store.get('mix-state')
    const sync = store.get('sync-state')
    tx.oncomplete = () => resolve(replica.result ? {...replica.result, ...sync.result, ...mix.result} : undefined)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('Could not read offline data'))
  })
}

async function updateData(write: (store: IDBObjectStore) => void): Promise<void> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('data', 'readwrite')
    write(tx.objectStore('data'))
    // Success only after the transaction is durable, not on request.onsuccess.
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('Could not save offline data'))
  })
}

function mixProgress(replica: Replica): MixProgressByLanguage {
  const mixes = {...(replica.mix ? {en: replica.mix} : {}), ...replica.mixes}
  if (!Object.keys(mixes).length) return {}
  const activeIds = new Set(replica.words.filter(word => !word.deleted_at).map(word => word.id))
  return Object.fromEntries(Object.entries(mixes).map(([language, mix]) => {
    const items = mix.items.filter(item => activeIds.has(item.word_id))
    return [language, {completed: items.filter(item => item.is_completed).length, total: items.length}]
  }))
}

export async function readMixProgress(language: string): Promise<MixProgress | null> {
  const stored = await readOfflineValue<MixProgressByLanguage>(MIX_PROGRESS)
  return stored?.[language] ?? null
}

export function initializeMixProgress(replica: Replica) {
  return updateData(store => {
    const entry = store.get(MIX_PROGRESS)
    entry.onsuccess = () => {
      if (entry.result === undefined) store.put(mixProgress(replica), MIX_PROGRESS)
    }
  })
}

export function mergeRestoredRecall(rows: RecallAttempt[], attempts: RecallAttempt[]) {
  const ids = new Set(rows.map(row => row.id).filter(Boolean))
  const merged = [...rows]
  for (const attempt of attempts) {
    if (attempt.uploaded || (attempt.id && ids.has(attempt.id))) continue
    const id = attempt.id ?? crypto.randomUUID()
    ids.add(id)
    merged.push({...attempt, id})
  }
  return merged.length > rows.length ? merged : rows
}

export function writeReplica(replica?: Replica, restoredRecall?: RecallAttempt[]): Promise<void> {
  return updateData(store => {
    if (replica) {
      store.put(replica, 'replica')
      store.put(mixProgress(replica), MIX_PROGRESS)
    } else {
      store.delete('replica')
      store.delete(MIX_PROGRESS)
    }
    store.delete('mix-state')
    store.delete('sync-state')
    if (replica?.restorePaused) store.put(true, RECALL_RESTORE_PAUSED)
    else if (replica) store.delete(RECALL_RESTORE_PAUSED)
    if (restoredRecall?.length) {
      const request = store.get(RECALL_HISTORY_KEY)
      request.onsuccess = () => store.put(mergeRestoredRecall(request.result ?? [], restoredRecall), RECALL_HISTORY_KEY)
    }
  })
}

export function writeSyncState(replica: Replica): Promise<void> {
  const {changes, cursor, forceWordIds, forceTopicIds, revisions, revision, savedAt, public_config, blockedChanges, refreshPending} = replica
  return updateData(store => store.put({changes, cursor, forceWordIds, forceTopicIds, revisions, revision,
    savedAt, public_config, blockedChanges, refreshPending}, 'sync-state'))
}

// Review-only writes leave the library and its sync revision intact.
export function writeMixState(replica: Replica): Promise<void> {
  const {mixes, mixReviewedAt, nextId} = replica
  return updateData(store => {
    store.put({mixes, mixReviewedAt, nextId}, 'mix-state')
    store.put(mixProgress(replica), MIX_PROGRESS)
  })
}

export async function readOfflineValue<T>(key: string): Promise<T | undefined> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('data', 'readonly')
    const request = tx.objectStore('data').get(key)
    tx.oncomplete = () => resolve(request.result)
    tx.onabort = () => reject(tx.error ?? new Error('Could not read offline data'))
  })
}

export function appendOfflineValue<T>(key: string, value: T, exists: (item: T) => boolean) {
  return mutateOfflineValue<T>(key, items => items.some(exists) ? items : [...items, value])
}

export function mutateOfflineValue<T>(key: string, update: (items: T[]) => T[]) {
  return updateData(store => {
    const entry = store.get(key)
    entry.onsuccess = () => {
      const items: T[] = entry.result ?? []
      const updated = update(items)
      if (updated !== items) store.put(updated, key)
    }
  })
}

export function deleteOfflineValue(key: string) {
  return updateData(store => {
    store.delete(key)
    if (key === RECALL_HISTORY_KEY) store.delete(RECALL_RESTORE_PAUSED)
  })
}

export async function readRecallUploadState() {
  const db = await open()
  return new Promise<{attempts: RecallAttempt[]; paused: boolean; hasReplica: boolean}>((resolve, reject) => {
    const tx = db.transaction('data', 'readonly')
    const store = tx.objectStore('data')
    const attempts = store.get(RECALL_HISTORY_KEY)
    const paused = store.get(RECALL_RESTORE_PAUSED)
    const replica = store.getKey('replica')
    tx.oncomplete = () => resolve({attempts: attempts.result ?? [], paused: paused.result === true, hasReplica: !!replica.result})
    tx.onabort = () => reject(tx.error ?? new Error('Could not read recall sync state.'))
  })
}

// One writer across tabs prevents an old tab overwriting newer queued edits.
export async function withOfflineLock<T>(work: () => Promise<T>, name = 'lexora-offline'): Promise<T> {
  if (!navigator.locks) return Promise.reject(new Error('Offline saving needs a current browser with Web Locks support.'))
  return await navigator.locks.request(name, work)
}
