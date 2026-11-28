import type {Replica} from './types'

const DATABASE = 'lexora-offline-v1'
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
    tx.oncomplete = () => resolve(replica.result ? {...replica.result, ...mix.result} : undefined)
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

export function writeReplica(replica?: Replica): Promise<void> {
  return updateData(store => {
    if (replica) store.put(replica, 'replica')
    else store.delete('replica')
    store.delete('mix-state')
  })
}

// Review-only writes leave the library and its sync revision intact.
export function writeMixState({mixes, mixReviewedAt, nextId}: Replica): Promise<void> {
  return updateData(store => store.put({mixes, mixReviewedAt, nextId}, 'mix-state'))
}

// One writer across tabs prevents an old tab overwriting newer queued edits.
export async function withOfflineLock<T>(work: () => Promise<T>): Promise<T> {
  if (!navigator.locks) return Promise.reject(new Error('Offline saving needs a current browser with Web Locks support.'))
  return await navigator.locks.request('lexora-offline', work)
}
