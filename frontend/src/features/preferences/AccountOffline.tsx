import { useState, useSyncExternalStore } from 'react'
import {
  exportOfflineBackup,
  offlineStatus,
  removeOffline,
  saveOffline,
  subscribeOffline,
  syncOffline,
} from '@/features/offline/offline'

export function AccountOffline() {
  const state = useSyncExternalStore(subscribeOffline, offlineStatus)
  const [error, setError] = useState('')
  const run = async (action: () => Promise<void>) => {
    setError('')
    try {
      await action()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not complete this action.')
    }
  }
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
            <span>Last synced</span>
            <span>{new Date(state.savedAt).toLocaleString()}</span>
          </div>
        )}
        <div className="account-actions">
          <button
            className="account-button"
            disabled={state.busy || !navigator.onLine}
            onClick={() => {
              void run(state.saved ? () => syncOffline(true) : saveOffline)
            }}
          >
            {state.busy ? 'Saving…' : state.saved ? 'Update offline copy' : 'Save all offline'}
          </button>
          {state.saved && (
            <button
              className="account-button"
              onClick={() => {
                void run(exportOfflineBackup)
              }}
            >
              Export offline backup
            </button>
          )}
          {state.saved && (
            <button
              className="account-button"
              disabled={state.busy}
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
      {state.offline && (
        <p role="status" className="account-help">
          Offline. Sync resumes when Lexora is open and connected.
        </p>
      )}
    </>
  )
}
