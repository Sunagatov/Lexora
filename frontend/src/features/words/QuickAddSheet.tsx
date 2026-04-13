import {createPortal} from 'react-dom'
import {useQuickAdd} from './useQuickAdd'

type Props = {onClose: () => void}

export function QuickAddSheet({onClose}: Props) {
  const q = useQuickAdd(onClose)

  function handleSheetKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose()
  }

  return createPortal(
    <>
      <div className="quick-add-overlay" onClick={onClose} />
      <div className="quick-add-sheet" role="dialog" aria-label="Add word" onKeyDown={handleSheetKeyDown}>
        <div className="quick-add-handle" />

        <div className="quick-add-header">
          <span className="quick-add-title">Add word</span>
          <button type="button" className="quick-add-close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="1" y1="1" x2="13" y2="13"/><line x1="13" y1="1" x2="1" y2="13"/>
            </svg>
          </button>
        </div>

        <div className="quick-add-body">
          <div className="quick-add-field">
            <label className="quick-add-label">Word or phrase</label>
            <input
              ref={q.termRef}
              className="quick-add-input"
              placeholder="e.g. ephemeral"
              value={q.term}
              onChange={(e) => q.setTerm(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); q.save().catch(() => {}) } }}
            />
            <div className="quick-add-actions-row">
              <button type="button" className="quick-add-action-btn quick-add-action-btn-primary"
                onClick={q.autoFill} disabled={!q.term.trim() || q.translating || q.suggesting}
                title="Translate + suggest topic automatically">
                {q.translating ? 'Translating…' : q.suggesting ? 'Suggesting…' : '✨ Auto-fill'}
              </button>
              <button type="button" className="quick-add-action-btn"
                onClick={q.translateOnly} disabled={!q.term.trim() || q.translating || q.suggesting}
                title="Translate only">
                Translate
              </button>
              <button type="button" className="quick-add-action-btn"
                onClick={q.suggestOnly} disabled={!q.term.trim() || q.suggesting || q.translating}
                title="Suggest topic based on word and translation">
                {q.suggesting ? '…' : 'Suggest topic'}
              </button>
            </div>
          </div>

          <div className="quick-add-field">
            <label className="quick-add-label">Translation</label>
            <input
              className="quick-add-input"
              placeholder="e.g. недолговечный"
              value={q.translation}
              onChange={(e) => q.setTranslation(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); q.save().catch(() => {}) } }}
            />
          </div>

          <div className="quick-add-field">
            <label className="quick-add-label">Topic {q.aiSuggested && <span className="quick-add-ai-badge">✨ AI suggested</span>}</label>
            {!q.addingTopic ? (
              <div className="quick-add-topic-row">
                <select className="quick-add-select" value={q.topicId ?? ''}
                  onChange={(e) => q.setTopicId(Number(e.target.value))}>
                  {q.topicsLoading && <option value="">Loading…</option>}
                  {!q.topicsLoading && q.topicId === null && <option value="" disabled>📥 Inbox (default)</option>}
                  {q.sortedTopics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button type="button" className="quick-add-new-topic-btn" onClick={() => q.setAddingTopic(true)}>+ New</button>
              </div>
            ) : (
              <div className="quick-add-topic-row">
                <input className="quick-add-input" placeholder="New topic name…" value={q.newTopic}
                  autoFocus maxLength={200} onChange={(e) => q.setNewTopic(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === 'Enter') { e.preventDefault(); if (q.newTopic.trim()) q.createTopic() }
                    if (e.key === 'Escape') q.cancelNewTopic()
                  }}
                />
                <button type="button" className="quick-add-translate-btn"
                  disabled={!q.newTopic.trim() || q.createTopicPending}
                  onClick={q.createTopic}>
                  {q.createTopicPending ? '…' : 'Create'}
                </button>
                <button type="button" className="quick-add-close" onClick={q.cancelNewTopic} aria-label="Cancel new topic">
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <line x1="1" y1="1" x2="13" y2="13"/><line x1="13" y1="1" x2="1" y2="13"/>
                  </svg>
                </button>
              </div>
            )}
          </div>

          {q.feedback && (
            <div className={`quick-add-feedback ${q.feedback.ok ? 'quick-add-feedback-ok' : 'quick-add-feedback-err'}`}>
              {q.feedback.msg}
            </div>
          )}
        </div>

        <div className="quick-add-footer">
          <button type="button" className="quick-add-cancel" onClick={onClose}>Cancel</button>
          <button type="button" className="quick-add-save" disabled={!q.canSave} onClick={q.save}>
            {q.savePending ? 'Saving…' : 'Save word'}
          </button>
        </div>
      </div>
    </>,
    document.body,
  )
}
