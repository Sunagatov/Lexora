import {useEffect, useRef, useState, type KeyboardEvent} from 'react'
import {createPortal} from 'react-dom'
import {useQuickAdd} from '@/features/words/hooks/useQuickAdd'

type Props = {onClose: () => void}
const CLOSE_MS = 220

export function QuickAddSheet({onClose}: Props) {
  const q = useQuickAdd(onClose)
  const sheetRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const [closing, setClosing] = useState(false)
  const [handleActive, setHandleActive] = useState(false)

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const id = window.requestAnimationFrame(() => q.termRef.current?.focus())
    return () => {
      window.cancelAnimationFrame(id)
      previousFocusRef.current?.focus?.()
    }
  }, [q.termRef])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  function requestClose() {
    if (closing) return
    setClosing(true)
    window.setTimeout(onClose, CLOSE_MS)
  }

  function focusableElements() {
    return Array.from(
      sheetRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter((element) => !element.hasAttribute('disabled') && element.offsetParent !== null)
  }

  function handleSheetKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') requestClose()
    if (e.key !== 'Tab') return

    const focusables = focusableElements()
    if (focusables.length === 0) return

    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    const current = document.activeElement

    if (e.shiftKey && current === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && current === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <>
      <div className={`quick-add-overlay${closing ? ' is-closing' : ''}`} onClick={requestClose} />
      <div className={`quick-add-sheet${closing ? ' is-closing' : ''}`} ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby="quick-add-title" onKeyDown={handleSheetKeyDown}>
        <button
          type="button"
          className={`quick-add-handle-hitbox${handleActive ? ' is-active' : ''}`}
          aria-label="Close quick add sheet"
          onClick={requestClose}
          onPointerDown={() => setHandleActive(true)}
          onPointerUp={() => setHandleActive(false)}
          onPointerCancel={() => setHandleActive(false)}
          onBlur={() => setHandleActive(false)}
        >
          <span className="quick-add-handle" />
        </button>

        <div className="quick-add-header">
          <span className="quick-add-title" id="quick-add-title">Add word</span>
          <button type="button" className="quick-add-close" onClick={requestClose} aria-label="Close">
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
          <button type="button" className="quick-add-cancel" onClick={requestClose}>Cancel</button>
          <button type="button" className="quick-add-save" disabled={!q.canSave} onClick={q.save}>
            {q.savePending ? 'Saving…' : 'Save word'}
          </button>
        </div>
      </div>
    </>,
    document.body,
  )
}
