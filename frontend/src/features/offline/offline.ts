import {ApiError} from '@/shared/api/apiError'
import {networkRequest, setRequestAdapter} from '@/shared/api/http'
import {readReplica, withOfflineLock, writeReplica} from './storage'
import {changeItem, remapId} from './changes'
import {languagePreferences} from '@/features/languages/api'
import {inLanguage, scopedReplica, listWords, sidebarStats, visibleWord} from './collections'
import type {Replica, Snapshot} from './types'
import type {StudyQueue} from '@/features/smart-review/types/studyQueueTypes'
import {CSRF_TOKEN_STORAGE_KEY} from '@/shared/auth/storage'

type Status = {saved: boolean; savedAt?: string; pending: number; busy: boolean; error?: string; offline: boolean; words: number; topics: number; topicAliases?: Record<number, number>}
let status: Status = {saved: false, pending: 0, busy: false, offline: !navigator.onLine, words: 0, topics: 0}
const listeners = new Set<() => void>()
let channel: BroadcastChannel | undefined
let initialized: Promise<void> | undefined
let syncing: Promise<void> | undefined
let refreshQueries = (_resetLists = false) => {}

export const subscribeOffline = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
export const offlineStatus = () => status
function notify(patch: Partial<Status>) { status = {...status, ...patch}; listeners.forEach(fn => fn()) }
function report(replica?: Replica) {
  notify({saved: !!replica, savedAt: replica?.savedAt, pending: replica?.changes.length ?? 0, words: replica?.words.filter(w => !w.deleted_at).length ?? 0, topics: replica?.topics.filter(t => !t.deleted_at).length ?? 0, topicAliases: replica?.topicAliases})
}

async function persist(replica?: Replica, resetLists = false) {
  const saved = replica ? {...replica, revision: crypto.randomUUID()} : undefined
  await writeReplica(saved)
  report(saved)
  channel?.postMessage({resetLists})
}

function isNetworkFailure(error: unknown) {
  return error instanceof TypeError
    || (error instanceof DOMException && ['TimeoutError', 'AbortError'].includes(error.name))
    || (error instanceof ApiError && error.status >= 500)
}

function newMix(replica: Replica): StudyQueue {
  const words = replica.words.filter(w => !w.deleted_at && inLanguage(w) && w.is_active && w.knowledge_level !== 5)
  // Fisher–Yates avoids biased random ordering and saves a stable local set.
  for (let i = words.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); [words[i], words[j]] = [words[j], words[i]]
  }
  const now = new Date().toISOString()
  return {id: replica.nextId--, generated_at: now, expires_at: new Date(Date.now() + 86_400_000).toISOString(), is_active: true, total_count: Math.min(words.length, 200), completed_count: 0,
    items: words.slice(0, 200).map((word, position) => ({id: replica.nextId--, word_id: word.id, position, word: visibleWord(replica, word), is_completed: false, completed_at: null}))}
}

function readMix(replica: Replica) {
  replica.mixes ??= replica.mix ? {en: replica.mix} : {}
  const language = languagePreferences().language
  const mix = replica.mixes[language] ??= newMix(replica)
  const words = new Map(replica.words.filter(w => !w.deleted_at).map(w => [w.id, w]))
  mix.items = mix.items.filter(item => words.has(item.word_id)).map(item => ({...item, word: visibleWord(replica, words.get(item.word_id)!)}))
  mix.total_count = mix.items.length
  mix.completed_count = mix.items.filter(item => item.is_completed).length
  return mix
}

async function localRequest(replica: Replica, path: string, init: RequestInit) {
  const url = new URL(path, window.location.origin), route = url.pathname, params = url.searchParams
  const method = init.method?.toUpperCase() ?? 'GET'
  const scope = scopedReplica(replica)
  const body = typeof init.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : {}
  if (method === 'GET') {
    if (route === '/api/config/public') return replica.public_config ?? {trash_retention_days: 30}
    if (route === '/api/words') return listWords(replica, params)
    if (route === '/api/topics') return scope.topics.filter(t => !t.deleted_at).sort((a, b) => a.name.localeCompare(b.name))
    if (route === '/api/topics/sidebar-stats') return sidebarStats(replica)
    if (route === '/api/words/summary') {
      const level_counts: Record<number, number> = {}
      const words = scope.words.filter(w => !w.deleted_at && (params.get('favorites_only') !== 'true' || w.is_favorite))
      words.forEach(w => { const level = w.knowledge_level ?? 0; level_counts[level] = (level_counts[level] ?? 0) + 1 })
      return {total: words.length, level_counts}
    }
    if (route === '/api/trash/words') return scope.words.filter(w => w.deleted_at).map(w => visibleWord(replica, w))
    if (route === '/api/trash/topics') return scope.topics.filter(t => t.deleted_at)
    const match = route.match(/^\/api\/(words|topics)\/(-?\d+)$/)
    if (match) {
      const isWord = match[1] === 'words'
      const aliases = isWord ? replica.wordAliases : replica.topicAliases
      const id = aliases?.[Number(match[2])] ?? Number(match[2])
      const item = (isWord ? scope.words : scope.topics).find(item => item.id === id && !item.deleted_at)
      if (!item) throw new ApiError(404, 'Item not found')
      return isWord ? visibleWord(replica, item as Replica['words'][number]) : item
    }
  }
  if (route === '/api/smart-review' || route.startsWith('/api/smart-review/')) {
    replica.mixes ??= replica.mix ? {en: replica.mix} : {}
    const language = languagePreferences().language
    const hadMix = !!replica.mixes[language]
    if (route.endsWith('/refresh') && method === 'POST') replica.mixes[language] = newMix(replica)
    const match = route.match(/\/items\/(-?\d+)\/complete$/)
    const mix = readMix(replica)
    if (match && method === 'POST') {
      const item = mix.items.find(item => item.id === Number(match[1]))
      if (!item) throw new ApiError(404, 'Practice item not found')
      item.is_completed = true; item.completed_at = new Date().toISOString()
    }
    const result = readMix(replica)
    if (!hadMix || method !== 'GET') await persist(replica)
    return result
  }
  if (route === '/api/words/batch' && method === 'PATCH') {
    const ids = body.word_ids as number[]
    let updated = 0
    for (const rawId of [...new Set(ids)]) {
      const id = replica.wordAliases?.[rawId] ?? rawId
      const word = replica.words.find(w => w.id === id && !w.deleted_at && inLanguage(w))
      if (!word) continue
      const data: Record<string, unknown> = {}
      if (body.knowledge_level !== undefined && body.knowledge_level !== null) data.knowledge_level = body.knowledge_level
      if (body.add_topic_ids || body.remove_topic_ids) {
        const remove = body.remove_topic_ids as number[] | undefined
        data.topic_ids = [...new Set([...word.topic_ids, ...(body.add_topic_ids as number[] ?? [])])].filter(id => !remove?.includes(id))
      }
      changeItem(replica, 'word', 'update', id, data); updated++
    }
    const resetLists = !!(body.add_topic_ids || body.remove_topic_ids)
    await persist(replica, resetLists)
    if (resetLists) refreshQueries(true)
    return {updated}
  }
  const create = route.match(/^\/api\/(words|topics)$/)
  const edit = route.match(/^\/api\/(words|topics)\/(-?\d+)$/)
  const restore = route.match(/^\/api\/trash\/(words|topics)\/(-?\d+)\/restore$/)
  if ((create && method === 'POST') || (edit && ['PUT', 'DELETE'].includes(method)) || (restore && method === 'POST')) {
    const match = (create ?? edit ?? restore)!
    const action = create ? 'create' : restore ? 'restore' : method === 'DELETE' ? 'delete' : 'update'
    const data = action === 'delete' && match[1] === 'topics' ? {delete_words: params.get('delete_words') === 'true'}
      : action === 'restore' && match[1] === 'topics' ? {restore_words: params.get('restore_words') === 'true'} : body
    const value = changeItem(replica, match[1] === 'words' ? 'word' : 'topic', action, Number(match[2] ?? -1), data)
    const ratingOnly = action === 'update' && match[1] === 'words' && Object.keys(data).every(key => ['knowledge_level', 'progress_source'].includes(key))
    await persist(replica, !ratingOnly)
    if (!ratingOnly) refreshQueries(true)
    return value
  }
  return UNHANDLED
}
const UNHANDLED = Symbol('unhandled')

export function initializeOffline(onRefresh: (resetLists?: boolean) => void): Promise<void> {
  refreshQueries = onRefresh
  initialized ??= (async () => {
    if (!('indexedDB' in window)) return
    try { report(await readReplica()) } catch { return }
    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel('lexora-offline')
      channel.onmessage = event => { void readReplica().then(report); refreshQueries(event.data?.resetLists === true) }
    }
    setRequestAdapter(async (path, init, network) => {
      if (path === '/auth/session') {
        if (localStorage.getItem('lexora-offline-logout')) {
          if (navigator.onLine) {
            await network('/auth/logout', {method: 'POST'})
            localStorage.removeItem('lexora-offline-logout')
          }
          return {authenticated: false, csrf_token: ''}
        }
        try { return await network(path, {...init, signal: init.signal ?? AbortSignal.timeout(10_000)}) }
        catch (error) {
          if (isNetworkFailure(error) && status.saved) { notify({offline: true}); return {authenticated: true, csrf_token: ''} }
          throw error
        }
      }
      if (path === '/auth/logout') {
        if (status.pending && !window.confirm('You have unsynced changes. Signing out will remove them from this device. Export an offline backup first if you want to keep them. Sign out anyway?')) throw new ApiError(499, 'Sign-out cancelled')
        try { await network(path, init) }
        catch (error) {
          if (error instanceof ApiError) throw error
          localStorage.setItem('lexora-offline-logout', '1')
        }
        await withOfflineLock(() => persist())
        return {ok: true}
      }
      if (!status.saved || !path.startsWith('/api/')) return network(path, init)
      const result = await withOfflineLock(async () => {
        const replica = await readReplica()
        return replica ? localRequest(replica, path, init) : UNHANDLED
      })
      if (result !== UNHANDLED) {
        if (init.method && navigator.onLine) void syncOffline()
        return result
      }
      if (!navigator.onLine || status.offline) throw new ApiError(503, 'This feature needs internet. Words, topics, search, practice and knowledge changes are available offline.')
      if (status.pending && init.method && init.method !== 'GET') throw new ApiError(409, 'Sync your saved edits before using this online feature.')
      const value = await network(path, init)
      if (init.method && (path.startsWith('/api/words/import/') || path.startsWith('/api/trash/purge'))) await syncOffline(true)
      return value
    })
    const reconnect = () => { notify({offline: !navigator.onLine}); if (navigator.onLine) void syncOffline() }
    window.addEventListener('online', reconnect)
    window.addEventListener('offline', reconnect)
    window.addEventListener('focus', () => { if (navigator.onLine) void syncOffline() })
    window.setInterval(() => { if (navigator.onLine && status.pending && document.visibilityState === 'visible') void syncOffline() }, 60_000)
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      void navigator.serviceWorker.register('/sw.js', {updateViaCache: 'none'}).catch(() => {})
    }
  })()
  return initialized
}

export async function saveOffline() {
  const language = languagePreferences().language
  notify({busy: true, error: undefined})
  try {
    if (status.pending) throw new Error('Sync or export your pending changes before replacing the saved copy.')
    if (!('serviceWorker' in navigator)) throw new Error('Offline saving requires HTTPS and a current browser.')
    const registration = await navigator.serviceWorker.register('/sw.js', {updateViaCache: 'none'})
    const worker = registration.installing ?? registration.waiting ?? registration.active
    if (worker && worker.state !== 'activated') await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('The offline app could not finish downloading. Try again online.')), 60_000)
      worker.addEventListener('statechange', () => {
        if (worker.state === 'activated') { clearTimeout(timer); resolve() }
        if (worker.state === 'redundant') { clearTimeout(timer); reject(new Error('Could not cache the app. Please retry.')) }
      })
    })
    await navigator.serviceWorker.ready
    const snapshot = await networkRequest<Snapshot>('/api/offline/snapshot', {headers: {'X-Lexora-All-Languages': 'true'}, signal: AbortSignal.timeout(60_000)})
    if (snapshot.version !== 1) throw new Error('Update the page before saving offline.')
    let mix: StudyQueue | undefined
    try { mix = await networkRequest<StudyQueue>('/api/smart-review', {headers: {'X-Lexora-Language': language}, signal: AbortSignal.timeout(20_000)}) }
    catch (error) { if (!(error instanceof ApiError && error.status === 503)) throw error }
    await withOfflineLock(async () => {
      if ((await readReplica())?.changes.length) throw new Error('Another tab has pending edits. Sync them before saving again.')
      await persist({...snapshot, savedAt: new Date().toISOString(), nextId: -Date.now(), changes: [], mixes: mix ? {[language]: mix} : {}})
    })
    // Storage persistence is a best-effort browser policy; never claim it is guaranteed.
    void navigator.storage?.persist?.()
    refreshQueries(true)
  } catch (error) { notify({error: error instanceof Error ? error.message : 'Could not save offline'}); throw error }
  finally { notify({busy: false}) }
}

export function syncOffline(forceRefresh = false): Promise<void> {
  if (syncing) return syncing
  if (!navigator.onLine || !status.saved) return Promise.resolve()
  if (!forceRefresh && !status.pending && !status.error && !status.offline && status.savedAt && Date.now() - Date.parse(status.savedAt) < 5 * 60_000) return Promise.resolve()
  syncing = (async () => {
    notify({busy: true, error: undefined})
    try {
      // Refresh CSRF after a new sign-in; do not sync against an expired session.
      const session = await networkRequest<{csrf_token: string}>('/auth/session', {signal: AbortSignal.timeout(15_000)})
      localStorage.setItem(CSRF_TOKEN_STORAGE_KEY, session.csrf_token)
      while (true) {
        const replica = await withOfflineLock(readReplica)
        if (!replica) break
        if (replica.changes.length) {
          const change = replica.changes[0]
          const result = await networkRequest<{entity_id: number}>('/api/offline/changes', {method: 'POST', headers: {'X-Lexora-Language': String(change.data.language ?? change.before.language ?? 'en')}, body: JSON.stringify(change), signal: AbortSignal.timeout(20_000)})
          await withOfflineLock(async () => {
            const latest = await readReplica()
            // Another tab may have already recorded the same server receipt.
            if (latest?.changes[0]?.id !== change.id) return
            latest.changes.shift()
            if (change.action === 'create') remapId(latest, change.entity, change.entity_id, result.entity_id)
            await persist(latest)
          })
          continue
        }
        // Network waits must not hold the storage lock needed by local edits.
        const snapshot = await networkRequest<Snapshot>('/api/offline/snapshot', {headers: {'X-Lexora-All-Languages': 'true'}, signal: AbortSignal.timeout(60_000)})
        const refreshed = await withOfflineLock(async () => {
          const latest = await readReplica()
          if (!latest) return true
          // Discard an outdated download if any tab edited the copy meanwhile.
          if (latest.changes.length || latest.revision !== replica.revision) return false
          await persist({...latest, ...snapshot, savedAt: new Date().toISOString()})
          return true
        })
        if (refreshed) break
      }
      notify({offline: false})
      refreshQueries(forceRefresh)
    } catch (error) {
      const networkFailure = isNetworkFailure(error)
      const message = error instanceof ApiError && error.status === 401 ? 'Sign in again to sync. Your offline changes are saved.'
        : error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'Could not sync. Your local changes are preserved.'
      notify({error: networkFailure ? undefined : message, offline: networkFailure})
    } finally { notify({busy: false}); syncing = undefined }
  })()
  return syncing
}

export async function removeOffline() {
  await withOfflineLock(() => persist())
  notify({error: undefined})
  refreshQueries(true)
}

export async function exportOfflineBackup() {
  const replica = await withOfflineLock(readReplica)
  if (!replica) return
  const url = URL.createObjectURL(new Blob([JSON.stringify(replica, null, 2)], {type: 'application/json'}))
  const link = document.createElement('a')
  link.href = url; link.download = `lexora-offline-${new Date().toISOString().slice(0, 10)}.json`; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
