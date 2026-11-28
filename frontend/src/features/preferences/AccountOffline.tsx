import { useRef, useState, useSyncExternalStore } from 'react'
import {parseOfflineBackup} from '@/features/offline/backup'
import {
  discardOfflineChange,
  exportOfflineBackup,
  offlineStatus,
  removeOffline,
  resolveOfflineConflict,
  restoreOfflineBackup,
  resumeOfflineSync,
  saveOffline,
  subscribeOffline,
  syncOffline,
} from '@/features/offline/offline'
import type {OfflineBackup} from '@/features/offline/types'
import {recallSyncStatus, subscribeRecallSync, syncRecallAttempts} from '@/features/stats/model/recallHistory'
import {OfflineConflict} from './OfflineConflict'

export function AccountOffline() {
  const state = useSyncExternalStore(subscribeOffline, offlineStatus)
  const recall = useSyncExternalStore(subscribeRecallSync, recallSyncStatus)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<{fileName: string; replica: OfflineBackup} | null>(null)
  const [backupBusy, setBackupBusy] = useState(false)
  const [resolving, setResolving] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const run = async (action: () => Promise<void>) => {
    setError('')
    try {
      await action()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not complete this action.')
    }
  }

  async function previewBackup(file: File) {
    setPreview(null)
    setBackupBusy(true)
    try {
      await run(async () => setPreview({fileName: file.name, replica: await parseOfflineBackup(file)}))
    } finally {
      setBackupBusy(false)
    }
  }

  async function restoreBackup(replica: OfflineBackup) {
    setBackupBusy(true)
    try {
      await run(async () => {
        await restoreOfflineBackup(replica)
        setPreview(null)
      })
    } finally {
      setBackupBusy(false)
    }
  }

  async function recoverEdit(action: () => Promise<void>) {
    setResolving(true)
    try {
      await run(action)
    } finally {
      setResolving(false)
    }
  }

  async function syncNow() {
    await run(async () => {
      if (state.restorePaused) await resumeOfflineSync()
      else if (state.saved) await syncOffline(true)
      else await saveOffline()
      await syncRecallAttempts(true)
    })
  }

  const busy = state.busy || recall.busy || backupBusy || resolving
  return (
    <>
      <div className="account-surface">
        <div className="account-row">
          <span>
            Saved library
            <small>
              {state.saved
                ? `${state.words.toLocaleString()} words · ${state.topics.toLocaleString()} topics on this device`
                : 'All words and topics, across all languages'}
            </small>
          </span>
          <span>{state.saved ? 'Saved' : 'Not saved'}</span>
        </div>
        <div className="account-row">
          <span>Word and topic edits waiting to sync</span>
          <span>{state.pending || 'None'}</span>
        </div>
        <div className="account-row">
          <span>
            Recall attempts waiting to sync
            {recall.failed > 0 && <small>{recall.failed.toLocaleString()} need a retry</small>}
          </span>
          <span>{recall.pending || 'None'}</span>
        </div>
        {state.savedAt && (
          <div className="account-row">
            <span>{state.restorePaused ? 'Backup date' : 'Last library refresh'}</span>
            <span>{new Date(state.savedAt).toLocaleString()}</span>
          </div>
        )}
        <div className="account-actions">
          <button
            className="account-button"
            disabled={busy || !navigator.onLine}
            onClick={() => void syncNow()}
          >
            {state.busy || recall.busy ? 'Syncing…' : state.restorePaused ? 'Sync restored copy' : state.saved ? 'Sync now' : 'Save all offline'}
          </button>
          {!state.saved && !!(recall.pending || recall.failed || recall.error) && (
            <button type="button" className="account-button" disabled={busy || !navigator.onLine}
              onClick={() => void run(() => syncRecallAttempts(true))}>Sync recall attempts</button>
          )}
          {state.saved && (
            <button
              className="account-button"
              disabled={busy}
              onClick={() => {
                void run(exportOfflineBackup)
              }}
            >
              Export offline backup
            </button>
          )}
          <button
            type="button"
            className="account-button"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            {backupBusy && !preview ? 'Reading backup…' : 'Choose offline backup'}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            aria-label="Offline backup file"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void previewBackup(file)
            }}
          />
          {state.saved && (
            <button
              className="account-button"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    state.pending
                      ? `Remove this device's saved copy and ${state.pending} unsynced changes? Export an offline backup first. Server data will be kept.`
                      : 'Remove the saved copy from this device? Server data will be kept.',
                  )
                )
                  void run(removeOffline)
              }}
            >
              Remove saved copy
            </button>
          )}
        </div>
      </div>
      {state.refreshPending && !state.restorePaused && (
        <p role="status" className="account-help">
          The saved library still needs to refresh. Sync now retries the refresh and any pending uploads.
        </p>
      )}
      {state.conflict && (
        <OfflineConflict conflict={state.conflict} busy={busy}
          onResolve={(choice) => {
            const changeId = state.conflict?.changeId
            if (changeId) void recoverEdit(() => resolveOfflineConflict(choice, changeId))
          }} />
      )}
      {!!state.issues?.length && (
        <section className="account-surface" aria-label="Edits that need attention">
          <h2 className="account-card-title">Edits that need attention</h2>
          {state.issues.map((issue) => (
            <div className="account-row" key={issue.changeId}>
              <span style={{overflowWrap: 'anywhere'}}>
                {issue.label}
                <small>{issue.message}</small>
              </span>
              <button type="button" className="account-button" disabled={busy}
                aria-label={`Discard edit for ${issue.label}`}
                onClick={() => {
                  if (window.confirm(`Discard the rejected edit for “${issue.label}”?`)) {
                    void recoverEdit(() => discardOfflineChange(issue.changeId))
                  }
                }}>Discard edit</button>
            </div>
          ))}
        </section>
      )}
      {preview && (
        <section className="account-surface" aria-label="Offline backup preview">
          <div className="account-row">
            <span>
              Offline backup preview
              <small>{preview.fileName} · Saved {new Date(preview.replica.savedAt).toLocaleString()}</small>
            </span>
          </div>
          <p className="account-help">
            {preview.replica.words.filter((word) => !word.deleted_at).length.toLocaleString()} active words
            {' · '}{preview.replica.topics.filter((topic) => !topic.deleted_at).length.toLocaleString()} active topics
            {' · '}{preview.replica.changes.length.toLocaleString()} pending edits
            {!!preview.replica.recallAttempts?.length && (
              <> · {preview.replica.recallAttempts.length.toLocaleString()} pending recall attempts</>
            )}
          </p>
          <p className="account-help">
            {state.pending
              ? 'Sync the edits already on this device before restoring a backup.'
              : 'Restore this backup as the saved library on this device. You can review it before resuming sync.'}
          </p>
          <div className="account-actions">
            <button type="button" className="account-button" disabled={busy || state.pending > 0}
              onClick={() => void restoreBackup(preview.replica)}>Restore backup</button>
            <button type="button" className="account-button" disabled={backupBusy}
              onClick={() => setPreview(null)}>Cancel preview</button>
          </div>
        </section>
      )}
      {state.restorePaused && (
        <p role="status" className="account-help">
          The restored copy is ready to use. Sync restored copy sends its queued edits and refreshes the library from Lexora.
        </p>
      )}
      <p className="account-help">
        Offline copies belong to this browser and device. Browsing, practice and word/topic edits
        work offline. AI, Excel imports/exports and historical statistics require internet. Spoken
        audio depends on installed voices.
      </p>
      <p className="account-help">
        Daily Word Mix keeps a practice copy on this device; knowledge changes sync. Export unsynced
        edits before clearing browser data.
      </p>
      {(error || state.error) && (
        <p role="alert" className="account-error">
          {error || state.error}
        </p>
      )}
      {recall.error && <p role="alert" className="account-error">Recall sync needs attention. {recall.error}</p>}
      {state.offline && !state.restorePaused && (
        <p role="status" className="account-help">
          Offline. Sync resumes when Lexora is open and connected.
        </p>
      )}
    </>
  )
}
