import { useRef, useState, useSyncExternalStore } from 'react'
import {parseOfflineBackup} from '@/features/offline/backup'
import {
  exportOfflineBackup,
  offlineStatus,
  removeOffline,
  restoreOfflineBackup,
  resumeOfflineSync,
  saveOffline,
  subscribeOffline,
  syncOffline,
} from '@/features/offline/offline'
import type {Replica} from '@/features/offline/types'

export function AccountOffline() {
  const state = useSyncExternalStore(subscribeOffline, offlineStatus)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<{fileName: string; replica: Replica} | null>(null)
  const [backupBusy, setBackupBusy] = useState(false)
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

  async function restoreBackup(replica: Replica) {
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

  const busy = state.busy || backupBusy
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
          <span>Changes waiting to sync</span>
          <span>{state.pending || 'None'}</span>
        </div>
        {state.savedAt && (
          <div className="account-row">
            <span>{state.restorePaused ? 'Backup date' : 'Last synced'}</span>
            <span>{new Date(state.savedAt).toLocaleString()}</span>
          </div>
        )}
        <div className="account-actions">
          <button
            className="account-button"
            disabled={busy || !navigator.onLine}
            onClick={() => {
              void run(state.restorePaused ? resumeOfflineSync : state.saved ? () => syncOffline(true) : saveOffline)
            }}
          >
            {state.busy ? 'Saving…' : state.restorePaused ? 'Sync restored copy' : state.saved ? 'Update offline copy' : 'Save all offline'}
          </button>
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
      {state.offline && !state.restorePaused && (
        <p role="status" className="account-help">
          Offline. Sync resumes when Lexora is open and connected.
        </p>
      )}
    </>
  )
}
