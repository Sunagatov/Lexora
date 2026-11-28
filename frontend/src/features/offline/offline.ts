import {ApiError} from '@/shared/api/apiError'
import {networkRequest, setRequestAdapter} from '@/shared/api/http'
import {initializeMixProgress, readReplica, withOfflineLock, writeMixState, writeReplica, writeSyncState} from './storage'
import {changeItem, remapId} from './changes'
import {applySnapshotUpdate, fetchSnapshot, fetchSnapshotUpdate, refreshAcceptedEdit} from './snapshotSync'
import {languagePreferences} from '@/features/languages/api'
import {activeTopicIds, inLanguage, scopedReplica, listWords, wordSummary, sidebarStats, visibleWord} from './collections'
import type {Change, OfflineBackup, OfflineConflict, Replica} from './types'
import {changeLabel, chooseUploads, describeRejected, undoRejected, uploadChanges} from './queuedChanges'
import type {StudyQueue} from '@/features/smart-review/types/studyQueueTypes'
import {CSRF_TOKEN_STORAGE_KEY} from '@/shared/auth/storage'
import {preferencesSnapshot} from '@/features/preferences/api'
import {selectWordMix} from '@/features/smart-review/model/selectWordMix'
import {clearRecallHistory, exportPendingRecallAttempts, pendingRecallCount, refreshRecallSyncStatus, syncRecallAttempts} from '@/features/stats/model/recallHistory'
import type {RecallAttempt} from '@/features/stats/model/recallHistory'
import {isIOSApp} from '@/shared/platform'
import {saveFile} from '@/shared/saveFile'

type Status = {saved: boolean; savedAt?: string; pending: number; busy: boolean; error?: string; offline: boolean; words: number; topics: number; restorePaused?: boolean; topicAliases?: Record<number, number>; conflict?: OfflineConflict; issues?: {changeId: string; entity: Change['entity']; label: string; message: string}[]; refreshPending?: boolean}
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
  const issues: NonNullable<Status['issues']> = []
  let conflict: OfflineConflict | undefined
  for (const change of replica?.changes ?? []) {
    const blocked = replica?.blockedChanges?.[change.id]
    if (!blocked) continue
    if (blocked.conflict) conflict ??= blocked.conflict
    else issues.push({changeId: change.id, entity: change.entity, label: changeLabel(change), message: blocked.message})
  }
  notify({saved: !!replica, savedAt: replica?.savedAt, pending: replica?.changes.length ?? 0, words: replica?.words.filter(w => !w.deleted_at).length ?? 0, topics: replica?.topics.filter(t => !t.deleted_at).length ?? 0, restorePaused: replica?.restorePaused, topicAliases: replica?.topicAliases, conflict, issues, refreshPending: replica?.refreshPending || !!conflict || !!issues.length})
}

async function persist(replica?: Replica, resetLists = false, metadataOnly = false, restoredRecall?: RecallAttempt[]) {
  const saved = replica ? {...replica, revision: crypto.randomUUID()} : undefined
  if (saved && metadataOnly) await writeSyncState(saved)
  else await writeReplica(saved, restoredRecall)
  report(saved)
  channel?.postMessage({resetLists})
}

function isNetworkFailure(error: unknown) {
  return error instanceof TypeError
    || (error instanceof DOMException && ['TimeoutError', 'AbortError'].includes(error.name))
    || (error instanceof ApiError && error.status >= 500)
}

function supportsIOSOffline() {
  return 'indexedDB' in window && !!navigator.locks && typeof globalThis.crypto?.randomUUID === 'function'
}

function newMix(replica: Replica): StudyQueue {
  replica.mixReviewedAt ??= {}
  for (const mix of [...Object.values(replica.mixes ?? {}), ...(replica.mix ? [replica.mix] : [])]) {
    for (const item of mix.items) {
      if (item.is_completed && item.completed_at && (!replica.mixReviewedAt[item.word_id] || item.completed_at > replica.mixReviewedAt[item.word_id])) {
        replica.mixReviewedAt[item.word_id] = item.completed_at
      }
    }
  }
  const words = selectWordMix(replica.words.filter(inLanguage), preferencesSnapshot().values.word_mix, replica.mixReviewedAt)
  const topicIds = activeTopicIds(replica)
  const now = new Date().toISOString()
  return {id: replica.nextId--, generated_at: now, expires_at: new Date(Date.now() + 86_400_000).toISOString(), is_active: true, total_count: words.length, completed_count: 0,
    items: words.map((word, position) => ({id: replica.nextId--, word_id: word.id, position, word: visibleWord(replica, word, topicIds), is_completed: false, completed_at: null}))}
}

function readMix(replica: Replica, mix: StudyQueue): StudyQueue {
  const itemWordIds = new Set(mix.items.map(item => item.word_id))
  const words = new Map(replica.words.filter(word => !word.deleted_at && itemWordIds.has(word.id)).map(word => [word.id, word]))
  const topicIds = activeTopicIds(replica)
  const items = mix.items.flatMap(item => {
    const word = words.get(item.word_id)
    return word ? [{...item, word: visibleWord(replica, word, topicIds)}] : []
  })
  return {...mix, items, total_count: items.length, completed_count: items.filter(item => item.is_completed).length}
}

const replicaReads = new Set(['/api/config/public', '/api/words', '/api/topics', '/api/topics/sidebar-stats',
  '/api/words/summary', '/api/trash/words', '/api/trash/topics', '/api/smart-review'])
const entryPath = /^\/api\/(words|topics)\/(-?\d+)$/
const collectionPath = /^\/api\/(words|topics)$/
const restorePath = /^\/api\/trash\/(words|topics)\/(-?\d+)\/restore$/
const mixCompletionPath = /^\/api\/smart-review\/items\/(-?\d+)\/complete$/

function usesSavedReplica(route: string, method: string) {
  switch (method) {
    case 'GET': return replicaReads.has(route) || entryPath.test(route)
    case 'POST': return collectionPath.test(route) || restorePath.test(route)
      || route === '/api/smart-review/refresh' || mixCompletionPath.test(route)
    case 'PATCH': return route === '/api/words/batch'
    case 'PUT':
    case 'DELETE': return entryPath.test(route)
    default: return false
  }
}

async function localRequest(replica: Replica, url: URL, method: string, init: RequestInit) {
  const {pathname: route, searchParams: params} = url
  if (route === '/api/smart-review' || route.startsWith('/api/smart-review/')) {
    const mixes = replica.mixes ??= replica.mix ? {en: replica.mix} : {}
    const language = languagePreferences().language
    const existing = mixes[language]
    const refresh = route.endsWith('/refresh') && method === 'POST'
    const mix = !existing || refresh ? newMix(replica) : readMix(replica, existing)
    const match = route.match(mixCompletionPath)
    if (match && method === 'POST') {
      const item = mix.items.find(item => item.id === Number(match[1]))
      if (!item) throw new ApiError(404, 'Practice item not found')
      if (!item.is_completed) {
        mix.completed_count++
        item.is_completed = true
        item.completed_at = new Date().toISOString()
      }
    }
    if (!existing || method !== 'GET') {
      mixes[language] = mix
      if (isIOSApp) {
        await writeMixState(replica)
        channel?.postMessage({resetLists: false})
      } else await persist(replica)
    }
    return mix
  }
  const scope = scopedReplica(replica)
  const body = typeof init.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : {}
  if (method === 'GET') {
    if (route === '/api/config/public') return replica.public_config ?? {trash_retention_days: 30}
    if (route === '/api/words') return listWords(replica, params)
    if (route === '/api/topics') return scope.topics.filter(t => !t.deleted_at).sort((a, b) => a.name.localeCompare(b.name))
    if (route === '/api/topics/sidebar-stats') return sidebarStats(replica)
    if (route === '/api/words/summary') return wordSummary(replica, params)
    if (route === '/api/trash/words') return scope.words.filter(w => w.deleted_at).map(w => visibleWord(replica, w))
    if (route === '/api/trash/topics') return scope.topics.filter(t => t.deleted_at)
    const match = route.match(entryPath)
    if (match) {
      const isWord = match[1] === 'words'
      const aliases = isWord ? replica.wordAliases : replica.topicAliases
      const id = aliases?.[Number(match[2])] ?? Number(match[2])
      const item = (isWord ? scope.words : scope.topics).find(item => item.id === id && !item.deleted_at)
      if (!item) throw new ApiError(404, 'Item not found')
      return isWord ? visibleWord(replica, item as Replica['words'][number]) : item
    }
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
  const create = route.match(collectionPath)
  const edit = route.match(entryPath)
  const restore = route.match(restorePath)
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
    if (!('indexedDB' in window) || (isIOSApp && !supportsIOSOffline())) return
    try {
      const replica = await readReplica()
      report(replica)
      if (replica) await initializeMixProgress(replica)
    } catch { return }
    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel('lexora-offline')
      channel.onmessage = event => { void readReplica().then(report); refreshQueries(event.data?.resetLists === true) }
    }
    setRequestAdapter(async (path, init, network) => {
      if (path === '/auth/session') {
        if (localStorage.getItem('lexora-offline-logout')) {
          if (navigator.onLine) {
            if (isIOSApp) {
              // A native request still needs the session's CSRF token.
              try {
                const session = await network<{csrf_token: string}>('/auth/session', {signal: AbortSignal.timeout(10_000)})
                await network('/auth/logout', {method: 'POST', headers: {'X-CSRF-Token': session.csrf_token}})
              } catch (error) {
                if (!(error instanceof ApiError && error.status === 401)) throw error
              }
            } else {
              await network('/auth/logout', {method: 'POST'})
            }
            localStorage.removeItem('lexora-offline-logout')
          }
          return {authenticated: false, csrf_token: ''}
        }
        if (isIOSApp && !navigator.onLine && status.saved) {
          notify({offline: true})
          return {authenticated: true, csrf_token: ''}
        }
        try { return await network(path, {...init, signal: init.signal ?? AbortSignal.timeout(10_000)}) }
        catch (error) {
          if (isNetworkFailure(error) && status.saved) { notify({offline: true}); return {authenticated: true, csrf_token: ''} }
          throw error
        }
      }
      if (path === '/auth/logout' || path === '/auth/logout-all') {
        await syncRecallAttempts()
        const recallPending = await pendingRecallCount().catch(() => 0)
        if ((status.pending || recallPending) && !window.confirm('You have unsynced edits or recall attempts. Signing out will remove them from this device. Sign out anyway?')) throw new ApiError(499, 'Sign-out cancelled')
        try { await network(path, init) }
        catch (error) {
          if (path === '/auth/logout-all' || error instanceof ApiError) throw error
          localStorage.setItem('lexora-offline-logout', '1')
        }
        await withOfflineLock(async () => {
          await persist()
          await clearRecallHistory()
        })
        return {ok: true}
      }
      if (!status.saved || !path.startsWith('/api/')) return network(path, init)
      const url = new URL(path, window.location.href)
      const method = init.method?.toUpperCase() ?? 'GET'
      const result = usesSavedReplica(url.pathname, method) ? await withOfflineLock(async () => {
        const replica = await readReplica()
        return replica ? localRequest(replica, url, method, init) : UNHANDLED
      }) : UNHANDLED
      if (result !== UNHANDLED) {
        if (init.method && navigator.onLine) void syncOffline()
        return result
      }
      if (!navigator.onLine || status.offline) throw new ApiError(503, 'This feature needs internet. Words, topics, search, practice and knowledge changes are available offline.')
      if (status.pending && method !== 'GET') throw new ApiError(409, 'Sync your saved edits before using this online feature.')
      const value = await network(path, init)
      if (init.method && (path.startsWith('/api/words/import/') || path.startsWith('/api/trash/purge'))) await syncOffline(true)
      return value
    })
    const reconnect = () => { notify({offline: !navigator.onLine}); if (navigator.onLine) void syncOffline() }
    window.addEventListener('online', reconnect)
    window.addEventListener('offline', reconnect)
    window.addEventListener('focus', () => { if (navigator.onLine) void syncOffline() })
    window.setInterval(() => { if (navigator.onLine && status.pending && document.visibilityState === 'visible') void syncOffline() }, 60_000)
    if (!isIOSApp && 'serviceWorker' in navigator && import.meta.env.PROD) {
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
    if (isIOSApp) {
      if (!supportsIOSOffline()) throw new Error('Offline saving is unavailable in this version of iOS. You can still study online.')
    } else {
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
    }
    const snapshot = await fetchSnapshot()
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

export function syncOffline(forceRefresh = false, retryBlocked = forceRefresh): Promise<void> {
  if (syncing) return syncing
  if (!navigator.onLine || !status.saved || status.restorePaused) return Promise.resolve()
  if (!forceRefresh && !status.pending && !status.error && !status.offline && !status.refreshPending &&
    status.savedAt && Date.now() - Date.parse(status.savedAt) < 5 * 60_000) return Promise.resolve()
  syncing = withOfflineLock(async () => {
    const attempted = new Set<string>()
    let batchSupported = true
    notify({busy: true, error: undefined})
    try {
      // Refresh CSRF after a new sign-in; do not sync against an expired session.
      const session = await networkRequest<{csrf_token: string}>('/auth/session', {signal: AbortSignal.timeout(15_000)})
      localStorage.setItem(CSRF_TOKEN_STORAGE_KEY, session.csrf_token)
      while (true) {
        const replica = await withOfflineLock(readReplica)
        if (!replica || replica.restorePaused) return
        const selected = chooseUploads(replica, attempted, retryBlocked)
        if (selected.length) {
          const changes = batchSupported ? selected : selected.slice(0, 1)
          let results
          try { results = await uploadChanges(changes) } catch (error) {
            if (changes.length === 1 || !(error instanceof ApiError) || ![404, 405, 413, 422].includes(error.status)) throw error
            batchSupported = false
            continue
          }
          changes.forEach(change => attempted.add(change.id))
          await withOfflineLock(async () => {
            const latest = await readReplica()
            if (!latest || latest.restorePaused) return
            let remapped = false, changed = false
            for (const outcome of results) {
              const index = latest.changes.findIndex(change => change.id === outcome.change_id)
              // Another tab may have already recorded the receipt or resolved the conflict.
              if (index < 0) continue
              const change = latest.changes[index]
              changed = true
              if (outcome.status !== 200) {
                (latest.blockedChanges ??= {})[change.id] = describeRejected(change, outcome.detail)
                continue
              }
              const id = outcome.result?.entity_id
              if (typeof id !== 'number' || !Number.isSafeInteger(id) || !id || (change.action !== 'create' && id !== change.entity_id)) {
                throw new Error('Lexora could not verify the upload receipt. Your edits are saved on this device.')
              }
              latest.changes.splice(index, 1)
              if (latest.blockedChanges) delete latest.blockedChanges[change.id]
              if (change.action === 'create') {
                remapId(latest, change.entity, change.entity_id, id)
                remapped = true
              }
              refreshAcceptedEdit(latest, change, id)
              latest.refreshPending = true
            }
            if (changed) await persist(latest, false, !remapped)
          })
          continue
        }
        if (replica.changes.length) {
          // Keep blocked edits visible in the saved library until the user resolves them.
          notify({offline: false, refreshPending: true})
          refreshQueries(forceRefresh)
          return
        }
        // Network waits must not hold the storage lock needed by local edits.
        notify({refreshPending: true})
        const snapshot = await fetchSnapshotUpdate(replica)
        const refreshed = await withOfflineLock(async () => {
          const latest = await readReplica()
          if (!latest) return true
          // Discard an outdated download if any tab edited the copy meanwhile.
          if (latest.changes.length || latest.revision !== replica.revision) return false
          const updated = {...applySnapshotUpdate(latest, snapshot), refreshPending: undefined}
          await persist(updated, false, updated.words === latest.words && updated.topics === latest.topics)
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
      if (status.refreshPending) await withOfflineLock(async () => {
        const replica = await readReplica()
        if (replica && !replica.refreshPending && !replica.restorePaused) {
          await persist({...replica, refreshPending: true}, false, true)
        }
      }).catch(() => { /* keep the current status if device storage is unavailable */ })
    } finally { notify({busy: false}); syncing = undefined }
  }, 'lexora-offline-sync')
  return syncing
}

export async function resolveOfflineConflict(choice: 'server' | 'device', changeId = status.conflict?.changeId) {
  if (!changeId) throw new Error('This edit changed. Review the current version.')
  await settleOfflineChange(changeId, choice, true)
}

export async function discardOfflineChange(changeId: string) {
  await settleOfflineChange(changeId, 'server', false)
}

async function settleOfflineChange(changeId: string, choice: 'server' | 'device', conflictOnly: boolean) {
  if (syncing) await syncing
  await withOfflineLock(() => withOfflineLock(async () => {
    const replica = await readReplica()
    const blocked = replica?.blockedChanges?.[changeId]
    const index = replica?.changes.findIndex(change => change.id === changeId) ?? -1
    if (!replica || index < 0 || !blocked || (conflictOnly && !blocked.conflict) || replica.restorePaused) {
      throw new Error('This edit changed. Review the current version.')
    }
    const change = replica.changes[index]
    if (choice === 'device') {
      if (!blocked.serverItem) throw new Error('The server has no current version for this edit.')
      replica.changes[index] = {...change, id: crypto.randomUUID(), before: blocked.serverItem}
    } else {
      replica.changes.splice(index, 1)
      undoRejected(replica, change, replica.changes.slice(index), blocked.serverItem)
      refreshAcceptedEdit(replica, change, change.entity_id)
      replica.refreshPending = true
    }
    delete replica.blockedChanges?.[changeId]
    await persist(replica, choice === 'server', choice === 'device')
  }), 'lexora-offline-sync')
  if (choice === 'server') refreshQueries(true)
  await syncOffline(true, false)
}

export async function removeOffline() {
  await withOfflineLock(() => persist())
  notify({error: undefined})
  refreshQueries(true)
}

export async function restoreOfflineBackup({recallAttempts, ...replica}: OfflineBackup) {
  await withOfflineLock(async () => {
    if ((await readReplica())?.changes.length) {
      throw new Error('Sync your current edits before replacing this saved copy.')
    }
    await persist({...replica, revisions: undefined, cursor: undefined, forceWordIds: undefined, forceTopicIds: undefined,
      blockedChanges: undefined, restorePaused: true}, true, false, recallAttempts)
  })
  if (recallAttempts?.length) await refreshRecallSyncStatus()
  notify({error: undefined})
  refreshQueries(true)
}

export async function resumeOfflineSync() {
  if (!navigator.onLine) throw new Error('Connect to Lexora before resuming sync.')
  if (syncing) await syncing
  await withOfflineLock(async () => {
    const replica = await readReplica()
    if (replica?.restorePaused) await persist({...replica, restorePaused: undefined})
  })
  await syncOffline(true)
}

export async function exportOfflineBackup() {
  const [replica, recallAttempts] = await withOfflineLock(async () => Promise.all([readReplica(), exportPendingRecallAttempts()]))
  if (!replica) return
  await saveFile(new Blob([JSON.stringify({...replica, blockedChanges: undefined, recallAttempts}, null, 2)], {type: 'application/json'}),
    `lexora-offline-${new Date().toISOString().slice(0, 10)}.json`)
}
