import { useRef, useState, useSyncExternalStore } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router-dom'
import { LEARNING_LANGUAGES, type LearningLanguage } from '@/features/languages/api'
import { request } from '@/shared/api/http'
import { exportWordsWorkbook } from '@/features/words/api/wordsApi'
import { WorkbookImportDialog } from '@/features/words/components/WorkbookImportDialog'
import type { Topic } from '@/features/topics/types/topicTypes'
import { offlineStatus, subscribeOffline } from '@/features/offline/offline'
import { usePreferences } from './api'

export function AccountData() {
  const location = useLocation()
  const preferences = usePreferences()
  const client = useQueryClient()
  const offline = useSyncExternalStore(subscribeOffline, offlineStatus)
  const [selection, setSelection] = useState('current')
  const [selected, setSelected] = useState<LearningLanguage[]>([preferences.language])
  const [scope, setScope] = useState('all')
  const [topicIds, setTopicIds] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const languages =
    selection === 'all'
      ? LEARNING_LANGUAGES.map((language) => language.code)
      : selection === 'current'
        ? [preferences.language]
        : selected
  const topicQuery = useQuery({
    queryKey: ['export-topics', languages],
    enabled: scope === 'topics',
    queryFn: async () =>
      (
        await Promise.all(
          languages.map(async (language) => ({
            language,
            topics: await request<Topic[]>('/api/topics', {
              headers: { 'X-Lexora-Language': language },
            }),
          })),
        )
      ).flatMap(({ language, topics }) => topics.map((topic) => ({ ...topic, language }))),
  })
  const unavailable = offline.offline || offline.pending > 0 || !navigator.onLine
  async function download() {
    setBusy(true)
    setError('')
    try {
      await exportWordsWorkbook(false, {
        languages,
        favoritesOnly: scope === 'favorites',
        topicIds: scope === 'topics' ? topicIds : undefined,
      })
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Export failed.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <div className="account-group-title">Export vocabulary</div>
      <div className="account-surface">
        <label className="account-row">
          <span>Languages</span>
          <select
            aria-label="Export languages"
            value={selection}
            onChange={(event) => {
              setSelection(event.target.value)
              setTopicIds([])
            }}
          >
            <option value="current">Current language</option>
            <option value="selected">Choose languages</option>
            <option value="all">All languages</option>
          </select>
        </label>
        {selection === 'selected' && (
          <fieldset className="account-language-checks">
            <legend className="sr-only">Languages to export</legend>
            {LEARNING_LANGUAGES.map((language) => (
              <label key={language.code}>
                <input
                  type="checkbox"
                  checked={selected.includes(language.code)}
                  onChange={(event) => {
                    setSelected((current) =>
                      event.target.checked
                        ? [...current, language.code]
                        : current.filter((code) => code !== language.code),
                    )
                    setTopicIds([])
                  }}
                />
                {language.icon} {language.name}
              </label>
            ))}
          </fieldset>
        )}
        <label className="account-row">
          <span>Words to include</span>
          <select
            aria-label="Words to export"
            value={scope}
            onChange={(event) => {
              setScope(event.target.value)
              setTopicIds([])
            }}
          >
            <option value="all">All words</option>
            <option value="favorites">Favorites</option>
            <option value="topics">Selected topics</option>
          </select>
        </label>
        {scope === 'topics' && (
          <fieldset className="account-topic-checks">
            <legend>Topics</legend>
            {topicQuery.isLoading && <p>Loading topics…</p>}
            {topicQuery.isError && (
              <p role="alert">
                Could not load topics.{' '}
                <button
                  onClick={() => {
                    void topicQuery.refetch()
                  }}
                >
                  Retry
                </button>
              </p>
            )}
            {topicQuery.data?.map((topic) => (
              <label key={topic.id}>
                <input
                  type="checkbox"
                  checked={topicIds.includes(topic.id)}
                  onChange={(event) =>
                    setTopicIds((current) =>
                      event.target.checked
                        ? [...current, topic.id]
                        : current.filter((id) => id !== topic.id),
                    )
                  }
                />
                {languages.length > 1 ? `${topic.language.toUpperCase()} · ` : ''}
                {topic.name}
              </label>
            ))}
          </fieldset>
        )}
        <div className="account-actions">
          <button
            className="account-button"
            disabled={
              busy || unavailable || !languages.length || (scope === 'topics' && !topicIds.length)
            }
            onClick={() => {
              void download()
            }}
          >
            {busy ? 'Exporting…' : languages.length > 1 ? 'Export Excel ZIP' : 'Export Excel'}
          </button>
        </div>
        <p className="account-help">
          Each language keeps its own importable Excel workbook. Multiple languages download
          together as a ZIP.
        </p>
      </div>
      <div className="account-group-title">Manage library</div>
      <div className="account-surface">
        <div className="account-row">
          <span>
            Import vocabulary
            <small>
              Into{' '}
              {LEARNING_LANGUAGES.find((language) => language.code === preferences.language)?.name}.
              Review changes before applying.
            </small>
          </span>
          <button
            className="account-button"
            disabled={unavailable}
            onClick={() => {
              if (input.current) input.current.value = ''
              input.current?.click()
            }}
          >
            Import
          </button>
        </div>
        <div className="account-row">
          <span>
            Trash<small>Review deleted words and topics</small>
          </span>
          <Link className="account-button" to="/account/trash" state={location.state}>
            Open
          </Link>
        </div>
      </div>
      {unavailable && (
        <p className="account-help">
          Connect and finish syncing saved edits before importing or exporting.
        </p>
      )}
      {error && (
        <p className="account-error" role="alert">
          {error}
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept=".xlsx"
        hidden
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
      />
      {file && (
        <WorkbookImportDialog
          file={file}
          onClose={() => setFile(null)}
          onApplied={async () => {
            setFile(null)
            await client.invalidateQueries()
          }}
        />
      )}
    </>
  )
}
