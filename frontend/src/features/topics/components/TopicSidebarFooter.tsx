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
          <span className="sidebar-add-topic-plus">+</span>
          <span className="sidebar-add-topic-text"> New topic</span>
        </button>
      )}
      <div className="sidebar-footer-actions-grid">
        <button type="button" className="sidebar-footer-btn" title="Statistics" onClick={onOpenStats}>
          <svg className="sidebar-footer-btn-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="1" y="8" width="3" height="7" rx="0.5"/><rect x="6.5" y="4" width="3" height="11" rx="0.5"/><rect x="12" y="1" width="3" height="14" rx="0.5"/></svg>
          <span className="sidebar-footer-btn-label">Stats</span>
        </button>
        <button type="button" className="sidebar-footer-btn" title="Trash" onClick={onOpenTrash}>
          <svg className="sidebar-footer-btn-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4h12"/><path d="M5 4V2.5A1.5 1.5 0 0 1 6.5 1h3A1.5 1.5 0 0 1 11 2.5V4"/><path d="M3.5 4l.7 9.8a1.5 1.5 0 0 0 1.5 1.2h4.6a1.5 1.5 0 0 0 1.5-1.2L12.5 4"/></svg>
          <span className="sidebar-footer-btn-label">Trash</span>
        </button>
        <button type="button" className="sidebar-footer-btn" title="Export Excel workbook" disabled={workbookBusy} onClick={onExport}>
          <svg className="sidebar-footer-btn-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v8"/><path d="M4.5 6.5 8 10l3.5-3.5"/><path d="M2.5 12v1.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V12"/></svg>
          <span className="sidebar-footer-btn-label">Export</span>
        </button>
        <button type="button" className="sidebar-footer-btn" title="Import Excel workbook" disabled={workbookBusy} onClick={onImportClick}>
          <svg className="sidebar-footer-btn-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 10V2"/><path d="M4.5 5.5 8 2l3.5 3.5"/><path d="M2.5 12v1.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V12"/></svg>
          <span className="sidebar-footer-btn-label">{workbookBusy ? 'Importing…' : 'Import'}</span>
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
