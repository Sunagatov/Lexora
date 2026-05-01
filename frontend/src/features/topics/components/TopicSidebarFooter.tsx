import type {ChangeEvent, RefObject} from 'react'
import type {Topic} from '@/features/topics/types/topicTypes'

type Props = {
  addingTopic: boolean
  topicError: string | null
  newTopicName: string
  newTopicParentId: number | ''
  topicOptions: Topic[]
  createPending: boolean
  workbookBusy: boolean
  importInputRef: RefObject<HTMLInputElement | null>
  onNewTopicNameChange: (value: string) => void
  onNewTopicParentIdChange: (value: number | '') => void
  onCreate: () => void
  onCancel: () => void
  onStartAdd: () => void
  onOpenStats: () => void
  onOpenTrash: () => void
  onExport: () => void
  onImportClick: () => void
  onImportChange: (event: ChangeEvent<HTMLInputElement>) => void
}

export function TopicSidebarFooter({
  addingTopic, topicError, newTopicName, newTopicParentId, topicOptions, createPending,
  workbookBusy, importInputRef, onNewTopicNameChange, onNewTopicParentIdChange, onCreate,
  onCancel, onStartAdd, onOpenStats, onOpenTrash, onExport, onImportClick, onImportChange,
}: Props) {
  return (
    <div className="sidebar-footer">
      {addingTopic ? (
        <div className="sidebar-new-topic-wrap">
          <div className="sidebar-new-topic-form">
            <select
              className="sidebar-new-topic-parent"
              value={newTopicParentId === '' ? '' : String(newTopicParentId)}
              onChange={(e) => {
                const value = e.target.value
                onNewTopicParentIdChange(value === '' ? '' : Number(value))
              }}
            >
              <option value="">Top-level topic</option>
              {topicOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <div className="sidebar-new-topic-row">
              <input
                className="sidebar-new-topic-input"
                placeholder="Topic name…"
                value={newTopicName}
                autoFocus
                maxLength={200}
                onChange={(e) => onNewTopicNameChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTopicName.trim() && !createPending) onCreate()
                  if (e.key === 'Escape') onCancel()
                }}
              />
              <button type="button" className="sidebar-new-topic-save" disabled={!newTopicName.trim() || createPending} onClick={onCreate}>
                {createPending ? '…' : 'Add'}
              </button>
              <button type="button" className="sidebar-new-topic-cancel" onClick={onCancel}>
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="1" y1="1" x2="13" y2="13"/><line x1="13" y1="1" x2="1" y2="13"/>
                </svg>
              </button>
            </div>
          </div>
          {topicError && <div className="sidebar-new-topic-error">{topicError}</div>}
        </div>
      ) : (
        <button type="button" className="sidebar-add-topic-btn" onClick={onStartAdd}>
          + New topic
        </button>
      )}
      <div className="sidebar-footer-actions-grid">
        <button type="button" className="sidebar-util-btn" title="Statistics" onClick={onOpenStats}>
          <span className="sidebar-util-icon">📊</span><span className="sidebar-util-label">Stats</span>
        </button>
        <button type="button" className="sidebar-util-btn" title="Trash" onClick={onOpenTrash}>
          <span className="sidebar-util-icon">🗑</span><span className="sidebar-util-label">Trash</span>
        </button>
        <button type="button" className="sidebar-secondary-action-btn" title="Export Excel workbook" disabled={workbookBusy} onClick={onExport}>
          <span className="sidebar-util-label">Export</span>
        </button>
        <button type="button" className="sidebar-secondary-action-btn" title="Import Excel workbook" disabled={workbookBusy} onClick={onImportClick}>
          <span className="sidebar-util-label">{workbookBusy ? 'Importing…' : 'Import'}</span>
        </button>
      </div>
      <input
        ref={importInputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        style={{display: 'none'}}
        onChange={onImportChange}
      />
    </div>
  )
}
