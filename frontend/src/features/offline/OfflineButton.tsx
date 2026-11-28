import {useEffect, useId, useRef, useState, useSyncExternalStore} from 'react'
import {createPortal} from 'react-dom'
import {Link, useLocation} from 'react-router-dom'
import {routes} from '@/app/routes'
import {languagePreferences} from '@/features/languages/api'
import {recallSyncStatus, subscribeRecallSync, syncRecallAttempts} from '@/features/stats/model/recallHistory'
import {exportOfflineBackup, offlineStatus, removeOffline, resumeOfflineSync, saveOffline, subscribeOffline, syncOffline} from './offline'

const changeCount = (count: number) => `${count} ${count === 1 ? 'change' : 'changes'}`
const recallCount = (count: number) => `${count} recall ${count === 1 ? 'attempt' : 'attempts'}`

function useSyncState() {
  const state = useSyncExternalStore(subscribeOffline, offlineStatus)
  const recall = useSyncExternalStore(subscribeRecallSync, recallSyncStatus)
  const attention = Boolean(state.conflict || state.issues?.length || state.refreshPending || state.restorePaused
    || state.error || recall.error || recall.failed)
  return {state, recall, attention}
}

function OfflineDialog({onClose}: {onClose: () => void}) {
  const {state, recall, attention} = useSyncState()
  const location = useLocation()
  const titleId = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const [error, setError] = useState('')
  const busy = state.busy || recall.busy
  const returnState = location.pathname.startsWith(routes.account) ? location.state : {
    returnTo: location.pathname + location.search + location.hash,
    returnLanguage: languagePreferences().language,
    returnState: location.state,
    returnScrollTop: document.querySelector<HTMLElement>('.word-collection-scroll, .all-words-page')?.scrollTop ?? 0,
  }
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close() }, [])
  const run = async (action: () => Promise<void>) => {
    setError('')
    try { await action() } catch (error) { setError(error instanceof Error ? error.message : 'Could not complete this action.') }
  }
  async function syncNow() {
    await run(async () => {
      if (state.restorePaused) await resumeOfflineSync()
      else if (state.saved) await syncOffline(true)
      else await saveOffline()
      await syncRecallAttempts(true)
    })
  }
  return createPortal(<dialog ref={dialog} className="offline-dialog" onCancel={onClose} aria-labelledby={titleId}>
    <h2 id={titleId}>Lexora offline</h2>
    <p>Save all words and topics on this device. Browse, search, practise, and add, edit or delete words and topics without internet.</p>
    <p>Edits sync when Lexora is open and connected. AI enrichment, Excel imports/exports and historical statistics need internet. Spoken audio depends on voices installed on your device.</p>
    <p>Daily Word Mix keeps a practice copy on this device. Knowledge changes and recall attempts sync to Lexora.</p>
    {state.offline && state.saved && !state.restorePaused && <p>Offline. You can use the saved copy while sync waits for a connection.</p>}
    {state.saved && <p>
      {state.words.toLocaleString()} words · {state.topics.toLocaleString()} topics<br />
      {state.savedAt && <>{state.restorePaused ? 'Backup date' : 'Last library refresh'} · {new Date(state.savedAt).toLocaleString()}<br /></>}
      {state.pending ? `${changeCount(state.pending)} waiting to sync` : 'No word or topic edits waiting to sync'}
    </p>}
    {state.refreshPending && !state.restorePaused && <p role="status">The saved library still needs to refresh.</p>}
    {state.restorePaused && <p role="status">Sync is paused for this restored backup.</p>}
    {!!recall.pending && <p>{recallCount(recall.pending)} waiting to sync</p>}
    {!!recall.failed && <p>{recallCount(recall.failed)} need a retry</p>}
    <p className="offline-note">This is a copy on this browser and device. Clearing browser data removes it. Keep a backup of unsynced edits; this is especially useful before resolving a sync conflict.</p>
    {(error || state.error) && <p role="alert" className="offline-error">{error || state.error}</p>}
    {recall.error && <p role="alert" className="offline-error">Recall sync needs attention. {recall.error}</p>}
    <p>
      <Link to={`${routes.account}/offline`} state={returnState} onClick={onClose}>
        {attention ? 'Review in Offline settings' : 'Open Offline settings'}
      </Link>
    </p>
    <div className="offline-dialog-actions">
      <button type="button" disabled={busy || !navigator.onLine} onClick={() => void syncNow()}>
        {busy ? 'Syncing…' : state.restorePaused ? 'Sync restored copy' : state.saved ? 'Sync now' : 'Save all offline'}
      </button>
      {!state.saved && !!(recall.pending || recall.failed || recall.error) && (
        <button type="button" disabled={busy || !navigator.onLine}
          onClick={() => void run(() => syncRecallAttempts(true))}>Sync recall attempts</button>
      )}
      {state.saved && <button type="button" disabled={busy} onClick={() => { void run(exportOfflineBackup) }}>Export offline backup</button>}
      {state.saved && <button type="button" disabled={busy} onClick={() => {
        if (window.confirm(state.pending ? `Remove the saved copy and ${state.pending} unsynced changes from this device? Export a backup first to keep them.` : 'Remove the offline copy from this device? Server data will be kept.')) void run(removeOffline)
      }}>Remove saved copy</button>}
      <button type="button" onClick={onClose}>Done</button>
    </div>
  </dialog>, document.body)
}

export function OfflineButton() {
  const {state, recall, attention} = useSyncState()
  const [open, setOpen] = useState(false)
  const label = attention ? 'Offline settings, sync needs attention' : state.saved ? 'Offline settings' : 'Save offline'
  const pending = state.pending + recall.pending
  return <>
    <button type="button" className="sidebar-footer-btn sidebar-footer-btn-secondary"
      aria-label={label} title={label} data-sidebar-tooltip={label} onClick={() => setOpen(true)}>
      <svg className="sidebar-footer-btn-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {state.saved ? <><circle cx="8" cy="8" r="6" /><path d="m5 8 2 2 4-4" /></>
          : <><path d="M8 2v8m-3.5-3.5L8 10l3.5-3.5" /><path d="M2.5 12v1.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V12" /></>}
      </svg>
      <span className="sidebar-footer-btn-label">{state.saved ? 'Offline saved' : 'Save offline'}{pending ? ` · ${pending}` : ''}</span>
    </button>
    {open && <OfflineDialog onClose={() => setOpen(false)} />}
  </>
}

export function OfflineStatus() {
  const {state, recall, attention} = useSyncState()
  const [open, setOpen] = useState(false)
  const visible = attention || state.pending > 0 || recall.pending > 0 || (state.saved && state.offline)
  return (
    <>
      {visible && (
        <button type="button" className="offline-status" onClick={() => setOpen(true)}
          title={`${changeCount(state.pending)} and ${recallCount(recall.pending)} waiting to sync`}
          aria-label={`Offline details. ${changeCount(state.pending)} and ${recallCount(recall.pending)} waiting to sync.${attention ? ' Sync needs attention.' : ''}`}
          aria-live="polite">
          {attention ? 'Sync !' : state.offline ? 'Offline' : 'Sync'}
        </button>
      )}
      {open && <OfflineDialog onClose={() => setOpen(false)} />}
    </>
  )
}
