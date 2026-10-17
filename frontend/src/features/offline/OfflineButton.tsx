import {useEffect, useRef, useState, useSyncExternalStore} from 'react'
import {createPortal} from 'react-dom'
import {exportOfflineBackup, offlineStatus, removeOffline, saveOffline, subscribeOffline, syncOffline} from './offline'

const changeCount = (count: number) => `${count} ${count === 1 ? 'change' : 'changes'}`

function OfflineDialog({onClose}: {onClose: () => void}) {
  const state = useSyncExternalStore(subscribeOffline, offlineStatus)
  const dialog = useRef<HTMLDialogElement>(null)
  const [error, setError] = useState('')
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close() }, [])
  const run = async (action: () => Promise<void>) => {
    setError('')
    try { await action() } catch (error) { setError(error instanceof Error ? error.message : 'Could not complete this action.') }
  }
  return createPortal(<dialog ref={dialog} className="offline-dialog" onCancel={onClose} aria-labelledby="offline-title">
    <h2 id="offline-title">Lexora offline</h2>
    <p>Save all words and topics on this device. Browse, search, practise, and add, edit or delete words and topics without internet.</p>
    <p>Edits sync when Lexora is open and connected. AI enrichment, Excel imports/exports and historical statistics need internet. Spoken audio depends on voices installed on your device.</p>
    <p>Daily Word Mix keeps a practice copy on this device. Its progress stays here; word knowledge levels sync to the server.</p>
    {state.offline && <p>Offline. Your saved copy is available; sync resumes when connected.</p>}
    {state.saved && <p>{state.words.toLocaleString()} words · {state.topics.toLocaleString()} topics<br />Last synced: {new Date(state.savedAt!).toLocaleString()}<br />{state.pending ? `${changeCount(state.pending)} waiting to sync` : 'All changes synced'}</p>}
    <p className="offline-note">This is a copy on this browser and device. Clearing browser data removes it. Keep a backup of unsynced edits; this is especially useful before resolving a sync conflict.</p>
    {(error || state.error) && <p role="alert" className="offline-error">{error || state.error}</p>}
    <div className="offline-dialog-actions">
      <button type="button" disabled={state.busy || !navigator.onLine} onClick={() => { void run(state.saved ? () => syncOffline(true) : saveOffline) }}>{state.busy ? 'Saving…' : state.saved ? 'Sync now' : 'Save all offline'}</button>
      {state.saved && <button type="button" onClick={() => { void run(exportOfflineBackup) }}>Export offline backup</button>}
      {state.saved && <button type="button" disabled={state.busy} onClick={() => {
        if (window.confirm(state.pending ? `Remove the saved copy and ${state.pending} unsynced changes from this device? Export a backup first to keep them.` : 'Remove the offline copy from this device? Server data will be kept.')) void run(removeOffline)
      }}>Remove saved copy</button>}
      <button type="button" onClick={onClose}>Done</button>
    </div>
  </dialog>, document.body)
}

export function OfflineButton() {
  const state = useSyncExternalStore(subscribeOffline, offlineStatus)
  const [open, setOpen] = useState(false)
  return <><button type="button" className="sidebar-save-offline-btn" aria-label={state.saved ? 'Offline settings' : 'Save offline'} title={state.saved ? 'Offline settings' : 'Save offline'} onClick={() => setOpen(true)}><span aria-hidden="true">{state.saved ? '✓' : '↓'}</span><span className="offline-button-label">{state.saved ? ' Offline saved' : ' Save offline'}{state.pending ? ` · ${state.pending}` : ''}</span></button>{open && <OfflineDialog onClose={() => setOpen(false)} />}</>
}

export function OfflineStatus() {
  const state = useSyncExternalStore(subscribeOffline, offlineStatus)
  const [open, setOpen] = useState(false)
  if (!state.saved) return null
  return <>{(state.offline || state.pending || state.error) && <button type="button" className="offline-status" onClick={() => setOpen(true)} title={`${changeCount(state.pending)} saved on this device. Open offline details.`} aria-label={`Offline details: ${changeCount(state.pending)} pending${state.error ? ', sync needs attention' : ''}`} aria-live="polite">{state.offline ? 'Offline' : state.error ? 'Sync !' : 'Sync'}{state.pending ? ` · ${state.pending}` : ''}</button>}{open && <OfflineDialog onClose={() => setOpen(false)} />}</>
}
