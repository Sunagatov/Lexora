import {useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent} from 'react'
import {createPortal} from 'react-dom'
import {useQuickAdd} from '@/features/words/hooks/useQuickAdd'
import {Toast} from '@/shared/components/Toast'

type Props = {onClose: () => void}

export function QuickAddSheet({onClose}: Props) {
  const q = useQuickAdd()
  const sheetRef = useRef<HTMLDivElement>(null)
  const [toastFeedback, setToastFeedback] = useState<{ok: boolean; msg: string} | null>(null)

  useEffect(() => {
    const id = window.requestAnimationFrame(() => q.termRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [q.termRef])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [])

  useEffect(() => {
    if (!q.feedback) return
    setToastFeedback(q.feedback)
  }, [q.feedback])

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function handleSheetKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') onClose()
  }

  const enriched = q.enrichDone && q.enrichResult

  return createPortal(
    <>
      <div className="quick-add-overlay" onClick={onClose} />
      <div className="quick-add-sheet" ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby="quick-add-title" onKeyDown={handleSheetKeyDown}>
        <button type="button" className="quick-add-handle-hitbox" aria-label="Close quick add sheet" onClick={onClose}>
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
          {/* Term + Enrich — compact row after enrichment */}
          <div className="quick-add-field">
            <label className="quick-add-label">Word or phrase</label>
            <div className="quick-add-term-row">
              <input
                ref={q.termRef}
                className="quick-add-input"
                placeholder="e.g. ephemeral"
                maxLength={255}
                value={q.term}
                onChange={(e) => q.setTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (!q.savePending && !q.enriching) {
                      if (enriched) q.save().catch(() => {})
                      else q.enrich()
                    }
                  }
                }}
              />
              <button type="button"
                className={`quick-add-enrich-btn ripple-btn${q.enriching ? ' is-loading' : ''}`}
                onClick={q.enrich}
                disabled={!q.term.trim() || q.enriching}>
                {q.enriching ? '…' : '✨'}
              </button>
            </div>
          </div>

          {/* Enriched details — the hero section, shown right after term */}
          {enriched && <EnrichPreview result={q.enrichResult!} />}

          {/* Translation — compact, usually auto-filled */}
          <div className="quick-add-field">
            <label className="quick-add-label">
              Translation
              {enriched && q.enrichResult!.translation_entries.length > 0 && (
                <span className="quick-add-field-status quick-add-field-status-ok">✓ AI</span>
              )}
            </label>
            <input
              className={`quick-add-input${enriched ? ' is-ai-complete' : ''}`}
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

          {/* Topic — compact single row */}
          <div className="quick-add-field">
            <label className="quick-add-label">Topic</label>
            {!q.addingTopic ? (
              <div className="quick-add-topic-row">
                <select className="quick-add-select" value={q.topicId ?? ''}
                  onChange={(e) => q.setTopicId(Number(e.target.value))}>
                  {q.topicsLoading && <option value="">Loading…</option>}
                  {!q.topicsLoading && q.topicId === null && <option value="" disabled>📥 Inbox (default)</option>}
                  {q.sortedTopics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button type="button" className="quick-add-new-topic-btn ripple-btn" onClick={() => q.setAddingTopic(true)}>+</button>
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
                <button type="button" className="quick-add-translate-btn ripple-btn"
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
          <button type="button" className="quick-add-cancel ripple-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="quick-add-save ripple-btn" disabled={!q.canSave} onClick={q.save}>
            {q.savePending ? 'Saving…' : 'Save word'}
          </button>
        </div>

        {toastFeedback && (
          <Toast
            message={toastFeedback.msg}
            type={toastFeedback.ok ? 'success' : 'error'}
            onClose={() => setToastFeedback(null)}
          />
        )}
      </div>
    </>,
    document.body,
  )
}

function EnrichPreview({result}: {result: import('@/features/words/types/wordTypes').EnrichResult}) {
  const chips: string[] = []
  if (result.part_of_speech) chips.push(result.part_of_speech)
  if (result.cefr_level) chips.push(result.cefr_level)
  if (result.register && result.register !== 'neutral') chips.push(result.register)
  if (result.countability) chips.push(result.countability)

  return (
    <div className="enrich-preview">
      {chips.length > 0 && (
        <div className="enrich-preview-chips">
          {chips.map((c) => <span key={c} className="enrich-chip">{c}</span>)}
        </div>
      )}

      {result.definition && (
        <div className="enrich-preview-row">
          <span className="enrich-preview-label">Definition</span>
          <span className="enrich-preview-value">{result.definition}</span>
        </div>
      )}

      {result.pronunciation_ipa && (
        <div className="enrich-preview-row">
          <span className="enrich-preview-label">IPA</span>
          <span className="enrich-preview-value">{result.pronunciation_ipa}</span>
        </div>
      )}

      {result.translation_entries.length > 0 && (
        <div className="enrich-preview-row">
          <span className="enrich-preview-label">Translations</span>
          <span className="enrich-preview-value">{result.translation_entries.join(', ')}</span>
        </div>
      )}

      {result.example_entries.length > 0 && (
        <div className="enrich-preview-row">
          <span className="enrich-preview-label">Examples</span>
          <ul className="enrich-preview-list">
            {result.example_entries.map((ex, i) => <li key={i}>{ex}</li>)}
          </ul>
        </div>
      )}

      {result.synonym_entries.length > 0 && (
        <div className="enrich-preview-row">
          <span className="enrich-preview-label">Synonyms</span>
          <span className="enrich-preview-value">{result.synonym_entries.join(', ')}</span>
        </div>
      )}

      {result.antonym_entries.length > 0 && (
        <div className="enrich-preview-row">
          <span className="enrich-preview-label">Antonyms</span>
          <span className="enrich-preview-value">{result.antonym_entries.join(', ')}</span>
        </div>
      )}

      {result.collocation_entries.length > 0 && (
        <div className="enrich-preview-row">
          <span className="enrich-preview-label">Collocations</span>
          <span className="enrich-preview-value">{result.collocation_entries.join(', ')}</span>
        </div>
      )}
    </div>
  )
}
