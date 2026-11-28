import {useId} from 'react'
import type {OfflineConflict as ConflictData} from '@/features/offline/types'
import {LEVEL_LABELS} from '@/features/words/model/wordDomain'

function fieldLabel(field: string) {
  if (field === 'topic_ids') return 'Topics'
  if (field === 'deleted_at') return 'In Trash'
  return field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, ' ')
}

function displayValue(value: unknown, field?: string): string {
  if (field === 'knowledge_level' && typeof value === 'number') {
    return LEVEL_LABELS[value === 2 ? 3 : value] ?? String(value)
  }
  if (value == null || value === '') return 'Empty'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.length ? value.map((entry) => displayValue(entry)).join(' · ') : 'None'
  if (typeof value === 'object') {
    const entries = Object.entries(value)
    return entries.length ? entries.map(([key, item]) => `${fieldLabel(key)}: ${displayValue(item)}`).join(' · ') : 'None'
  }
  return String(value)
}

export function OfflineConflict({conflict, busy, onResolve}: {
  conflict: ConflictData
  busy: boolean
  onResolve: (choice: 'server' | 'device') => void
}) {
  const titleId = useId()
  return (
    <section className="account-surface" aria-labelledby={titleId} aria-busy={busy}>
      <h2 id={titleId} className="account-card-title">Review sync conflict</h2>
      <div className="account-row">
        <span style={{overflowWrap: 'anywhere'}}>
          {conflict.label || (conflict.entity === 'word' ? 'Word' : 'Topic')}
          <small>This item changed on the server while you had an edit saved on this device.</small>
        </span>
      </div>
      {conflict.fields.map(({field, before, device, server}) => (
        <div className="account-row" key={field}>
          <span style={{overflowWrap: 'anywhere'}}>
            {fieldLabel(field)}
            <small><strong>Original</strong>{' '}{displayValue(before, field)}</small>
            <small><strong>This device</strong>{' '}{displayValue(device, field)}</small>
            <small><strong>Server</strong>{' '}{displayValue(server, field)}</small>
          </span>
        </div>
      ))}
      <div className="account-actions">
        <button type="button" className="account-button" disabled={busy} onClick={() => onResolve('server')}>
          Keep server version
        </button>
        <button type="button" className="account-button" disabled={busy} onClick={() => onResolve('device')}>
          Reapply my edit
        </button>
      </div>
    </section>
  )
}
