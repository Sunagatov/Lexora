import {useEffect, useId, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import {ApiError} from '@/shared/api/apiError'
import {redirectIfUnauthorized} from '@/features/auth/lib/redirectIfUnauthorized'
import {
  applyWordsWorkbook,
  exportWordsWorkbook,
  fetchWorkbookRecovery,
  previewWordsWorkbook,
} from '@/features/words/api/wordsApi'
import type {
  ImportEntry,
  ImportIssue,
  WorkbookImportResult,
  WorkbookPreview,
} from '@/features/words/types/wordTypes'
import './workbookImport.css'

type Props = {file: File; onClose: () => void; onApplied: () => Promise<unknown>}

function download(value: unknown, name: string, csv = false) {
  const url = URL.createObjectURL(
    new Blob([csv ? String(value) : JSON.stringify(value, null, 2)], {
      type: csv ? 'text/csv;charset=utf-8' : 'application/json',
    }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function downloadIssues(preview: WorkbookPreview) {
  const cell = (value: string | number) =>
    '"' +
    String(value)
      .replace(/^\s*[=+@-]/, "'$&")
      .replace(/"/g, '""') +
    '"'
  const rows = [
    ['Type', 'Sheet', 'Row', 'Message'],
    ...preview.errors.map((item) => ['Error', item.sheet, item.row, item.message]),
    ...preview.warnings.map((item) => ['Warning', item.sheet, item.row, item.message]),
  ]
  download(
    '\uFEFF' + rows.map((row) => row.map(cell).join(',')).join('\r\n'),
    'lexora-import-issues.csv',
    true,
  )
}

function Issues({title, items}: {title: string; items: ImportIssue[]}) {
  return (
    items.length > 0 && (
      <details className="workbook-issues">
        <summary>
          {title} ({items.length.toLocaleString()})
        </summary>
        <ul>
          {items.slice(0, 30).map((item, index) => (
            <li key={index}>
              <strong>
                {item.sheet}:{item.row}
              </strong>{' '}
              — {item.message}
            </li>
          ))}
        </ul>
        {items.length > 30 && <p>Showing the first 30. Download the issues report for all rows.</p>}
      </details>
    )
  )
}

const display = (value: unknown) =>
  Array.isArray(value) ? value.join(' · ') : String(value ?? '—')

function Change({
  entry,
  topicLabels = {},
}: {
  entry: ImportEntry
  topicLabels?: Record<string, string>
}) {
  const fieldValue = (field: string, value: unknown) =>
    display(
      field === 'topic_ids' && Array.isArray(value)
        ? value.map((ref) => topicLabels[String(ref)] ?? ref)
        : value,
    )
  return (
    <details className="workbook-change">
      <summary>
        {String(entry.after.term)}{' '}
        <span>{entry.action === 'create' ? 'New word' : `Update #${entry.word_id}`}</span>
      </summary>
      <p className="workbook-muted">
        {entry.locations.map((location) => `${location.sheet}:${location.row}`).join(', ')}
      </p>
      <dl>
        {Object.entries(entry.after)
          .filter(
            ([field, after]) => JSON.stringify(after) !== JSON.stringify(entry.before?.[field]),
          )
          .map(([field, after]) => (
            <div key={field}>
              <dt>{field === 'topic_ids' ? 'Topics' : field.replace(/_/g, ' ')}</dt>
              <dd>
                {entry.before && <del>{fieldValue(field, entry.before[field])}</del>}
                <span>{fieldValue(field, after)}</span>
              </dd>
            </div>
          ))}
      </dl>
    </details>
  )
}

export function WorkbookImportDialog({file, onClose, onApplied}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const controller = useRef<AbortController | null>(null)
  const titleId = useId()
  const modeId = useId()
  const minimumId = useId()
  const [mode, setMode] = useState<'add' | 'content'>('add')
  const [minimum, setMinimum] = useState(4)
  const [preview, setPreview] = useState<WorkbookPreview | null>(null)
  const [result, setResult] = useState<WorkbookImportResult | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [warningsReviewed, setWarningsReviewed] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    const active = document.activeElement as HTMLElement | null
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog?.showModal()
    return () => {
      controller.current?.abort()
      dialog?.close()
      document.body.style.overflow = previous
      active?.focus({preventScroll: true})
    }
  }, [])

  function reportError(err: unknown) {
    redirectIfUnauthorized(err)
    if (err instanceof Error && err.name !== 'AbortError') setError(err.message)
  }

  async function inspect() {
    setPending(true)
    setError(null)
    setPreview(null)
    setPage(0)
    setWarningsReviewed(false)
    controller.current = new AbortController()
    try {
      setPreview(await previewWordsWorkbook(file, mode, minimum, controller.current.signal))
    } catch (err) {
      reportError(err)
    } finally {
      setPending(false)
    }
  }

  async function apply() {
    if (!preview) return
    setPending(true)
    setError(null)
    try {
      const completed = await applyWordsWorkbook(preview)
      setResult(completed)
      // A cache refresh failure must not turn a completed import into a failed import.
      await onApplied().catch(() => {})
    } catch (err) {
      reportError(err)
      if (err instanceof ApiError && err.status === 409) setPreview(null)
    } finally {
      setPending(false)
    }
  }

  const changes = preview?.entries.filter((entry) => entry.action !== 'unchanged') ?? []
  const hasChanges = !!preview && (changes.length > 0 || preview.summary.topics_created > 0)
  return createPortal(
    <dialog
      ref={dialogRef}
      className="workbook-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        if (!pending) onClose()
      }}
    >
      <header>
        <h2 id={titleId}>{result ? 'Import complete' : 'Import vocabulary'}</h2>
        <p className="workbook-muted">{file.name}</p>
      </header>
      <div className="workbook-body">
        {result ? (
          <>
            <p role="status">
              {result.created.toLocaleString()} new · {result.updated.toLocaleString()} updated ·{' '}
              {result.unchanged.toLocaleString()} unchanged
            </p>
            <p>Learning progress was preserved. {result.topics_created} topics created.</p>
            <button
              className="btn btn-secondary"
              disabled={pending}
              onClick={async () => {
                try {
                  download(
                    await fetchWorkbookRecovery(result.batch_id),
                    `lexora-recovery-${result.batch_id}.json`,
                  )
                } catch (err) {
                  reportError(err)
                }
              }}
            >
              Download recovery record
            </button>
          </>
        ) : (
          <>
            <details open={!preview} className="workbook-settings">
              <summary>Import settings</summary>
              <fieldset disabled={pending} className="workbook-options">
                <div>
                  <label htmlFor={modeId}>Import mode</label>
                  <select
                    id={modeId}
                    value={mode}
                    onChange={(event) => {
                      setMode(event.target.value as 'add' | 'content')
                      setPreview(null)
                    }}
                  >
                    <option value="add">Add new words</option>
                    <option value="content">Update vocabulary content</option>
                  </select>
                </div>
                <p>
                  {mode === 'add'
                    ? 'Add new words and topic links. Existing word content stays unchanged.'
                    : 'Update non-empty content fields and add new words. Blank cells keep existing values.'}{' '}
                  Learning progress always stays unchanged.
                </p>
                <div>
                  <label htmlFor={minimumId}>Warn below this many translations</label>
                  <input
                    id={minimumId}
                    type="number"
                    min={0}
                    max={20}
                    value={minimum}
                    onChange={(event) => {
                      setMinimum(Math.max(0, Math.min(20, Math.trunc(Number(event.target.value)))))
                      setPreview(null)
                    }}
                  />
                </div>
                <p>
                  Use one row per word. Leave Word ID blank for new entries. Separate translations
                  and topic references with new lines. List new topics on the Topics sheet.
                </p>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    void exportWordsWorkbook(true).catch(reportError)
                  }}
                >
                  Download blank template
                </button>
              </fieldset>
            </details>
            {preview && (
              <section aria-label="Import preview">
                <p className="workbook-counts">
                  {preview.summary.created.toLocaleString()} new ·{' '}
                  {preview.summary.updated.toLocaleString()} updated ·{' '}
                  {preview.summary.unchanged.toLocaleString()} unchanged
                </p>
                <p>
                  {preview.summary.rows.toLocaleString()} rows · {preview.summary.topics_created}{' '}
                  new topics. Vocabulary has not changed yet.
                </p>
                {preview.topics.length > 0 && (
                  <p>New topics: {preview.topics.map((topic) => topic.name).join(', ')}</p>
                )}
                <Issues title="Errors — fix these before applying" items={preview.errors} />
                <Issues title="Quality warnings" items={preview.warnings} />
                {(preview.errors.length > 0 || preview.warnings.length > 0) && (
                  <button className="btn btn-ghost" onClick={() => downloadIssues(preview)}>
                    Download issues report
                  </button>
                )}
                {preview.warnings.length > 0 && !preview.errors.length && (
                  <label className="workbook-ack">
                    <input
                      type="checkbox"
                      checked={warningsReviewed}
                      onChange={(event) => setWarningsReviewed(event.target.checked)}
                    />
                    I reviewed the quality warnings
                  </label>
                )}
                {changes.slice(page * 20, page * 20 + 20).map((entry, index) => (
                  <Change
                    key={page * 20 + index}
                    entry={entry}
                    topicLabels={preview.topic_labels}
                  />
                ))}
                {changes.length > 20 && (
                  <nav aria-label="Preview pages">
                    <button
                      className="btn btn-ghost"
                      disabled={page === 0}
                      onClick={() => setPage(page - 1)}
                    >
                      Previous
                    </button>
                    <span>
                      {page + 1} / {Math.ceil(changes.length / 20)}
                    </span>
                    <button
                      className="btn btn-ghost"
                      disabled={(page + 1) * 20 >= changes.length}
                      onClick={() => setPage(page + 1)}
                    >
                      Next
                    </button>
                  </nav>
                )}
                <button
                  className="btn btn-ghost"
                  onClick={() => download(preview, 'lexora-import-preview.json')}
                >
                  Download full preview
                </button>
                {!hasChanges && !preview.errors.length && (
                  <p>Everything in this file is already up to date.</p>
                )}
              </section>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="wp-save-error">
            {error}
          </p>
        )}
      </div>
      <footer>
        <button className="btn btn-secondary" disabled={pending} onClick={onClose}>
          {result ? 'Done' : 'Cancel'}
        </button>
        {!result && (
          <button
            className="btn btn-primary"
            disabled={pending}
            onClick={() => {
              void inspect()
            }}
          >
            {pending ? 'Working…' : preview ? 'Refresh preview' : 'Preview import'}
          </button>
        )}
        {!result && preview && (
          <button
            className="btn btn-primary"
            disabled={
              pending ||
              !preview.batch_id ||
              !!preview.errors.length ||
              !hasChanges ||
              (!!preview.warnings.length && !warningsReviewed)
            }
            onClick={() => {
              void apply()
            }}
          >
            Apply import
          </button>
        )}
      </footer>
    </dialog>,
    document.body,
  )
}
