import {useEffect, useRef, type KeyboardEvent} from 'react'
import {createPortal} from 'react-dom'
import {useQuickAdd} from '@/features/words/hooks/useQuickAdd'

type Props = {onClose: () => void}

export function QuickAddSheet({onClose}: Props) {
  const q = useQuickAdd()
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = window.requestAnimationFrame(() => q.termRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [q.termRef])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function handleSheetKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') onClose()
  }

  return createPortal(
    <>
      <div className="quick-add-overlay" onClick={onClose} />
      <div className="quick-add-sheet" ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby="quick-add-title" onKeyDown={handleSheetKeyDown}>
        <button
          type="button"
          className="quick-add-handle-hitbox"
          aria-label="Close quick add sheet"
          onClick={onClose}
        >
          <span className="quick-add-handle" />
        </button>

        <div className="quick-add-header">
          <span className="quick-add-title" id="quick-add-title">Add word</span>
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (!q.savePending) q.save().catch(() => {})
                }
              }}
            />
            <div className="quick-add-actions-row">
              <button type="button" className={`quick-add-action-btn quick-add-action-btn-primary${q.autoFillPending ? ' is-loading' : ''}`}
                onClick={q.autoFill} disabled={!q.term.trim() || q.translating || q.suggesting}
                title="Translate + suggest topic automatically">
                <span className="quick-add-action-btn-text">
                  {q.translating ? 'Translating…' : q.suggesting ? 'Suggesting…' : '✨ Auto-fill AI'}
                </span>
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
            <label className="quick-add-label">
              Translation
              {q.translationAiDone && (
                <span className="quick-add-field-status quick-add-field-status-ok">✓ AI filled</span>
              )}
            </label>
            <input
              className={`quick-add-input${q.translationAiDone ? ' is-ai-complete' : ''}`}
              placeholder="e.g. недолговечный"
              value={q.translation}
              onChange={(e) => q.setTranslation(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (!q.savePending) q.save().catch(() => {})
                }
              }}
            />
          </div>

          <div className="quick-add-field">
            <label className="quick-add-label">
              Topic
              {q.aiSuggested && <span className="quick-add-ai-badge">✨ AI suggested</span>}
              {q.topicAiDone && <span className="quick-add-field-status">✨ Completed</span>}
            </label>
            {!q.addingTopic ? (
              <div className="quick-add-topic-row">
                <select className={`quick-add-select${q.topicAiDone ? ' is-ai-complete' : ''}`} value={q.topicId ?? ''}
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
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (q.newTopic.trim() && !q.createTopicPending) q.createTopic()
                    }
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
