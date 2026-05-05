# Add Word Modal Modernization: 2026 UI/UX Design

## Overview
Completely redesign the "Add word" modal with modern layout, improved visual hierarchy, better form inputs, and enhanced feedback states for a premium 2026 experience.

## Current Issues
1. Cramped, dense layout — No breathing room
2. Poor visual hierarchy — All sections equal weight
3. Form inputs basic — No floating label pattern
4. Enriched content cluttered — Tags/definitions/examples messy
5. Buttons unclear — CTA at bottom, hard to find
6. No loading states — User doesn't know enrichment is happening
7. Dark mode contrast poor — Hard to read
8. Section dividers missing — Can't distinguish form from enrichment
9. Mobile unfriendly — Scrolling unclear, cramped on small screens
10. No clear field states — No indication of success/error/loading

---

## Files to Modify
1. `frontend/src/features/words/components/QuickAddSheet.tsx` — Redesign modal structure
2. `frontend/src/styles/quick-add.css` — Complete CSS overhaul with new layout
3. `frontend/src/shared/components/Badge.tsx` — NEW component for tags (A2, Countable, etc.)
4. `frontend/src/shared/components/Section.tsx` — NEW component for content sections

---

## 1. Badge Component (NEW)

### Create: `frontend/src/shared/components/Badge.tsx`

```typescript
type Props = {
  children: React.ReactNode
  variant?: 'info' | 'level' | 'feature'
  icon?: React.ReactNode
}

export function Badge({ children, variant = 'info', icon }: Props) {
  return (
    <span className={`badge badge-${variant}`}>
      {icon && <span className="badge-icon">{icon}</span>}
      <span className="badge-text">{children}</span>
    </span>
  )
}
```

---

## 2. Section Component (NEW)

### Create: `frontend/src/shared/components/Section.tsx`

```typescript
type Props = {
  icon?: React.ReactNode
  title?: string
  subtitle?: string
  children: React.ReactNode
  variant?: 'form' | 'content' | 'preview'
}

export function Section({ icon, title, subtitle, children, variant = 'content' }: Props) {
  return (
    <section className={`section section-${variant}`}>
      {(icon || title) && (
        <div className="section-header">
          {icon && <span className="section-icon">{icon}</span>}
          <div className="section-titles">
            {title && <h3 className="section-title">{title}</h3>}
            {subtitle && <p className="section-subtitle">{subtitle}</p>}
          </div>
        </div>
      )}
      <div className="section-content">
        {children}
      </div>
    </section>
  )
}
```

---

## 3. QuickAddSheet.tsx Redesign

### Complete Restructure

```typescript
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useQuickAdd } from '@/features/words/hooks/useQuickAdd'
import { Toast } from '@/shared/components/Toast'
import { Badge } from '@/shared/components/Badge'
import { Section } from '@/shared/components/Section'

type Props = { onClose: () => void }

export function QuickAddSheet({ onClose }: Props) {
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
        
        {/* Header */}
        <div className="quick-add-header">
          <div className="quick-add-header-content">
            <h1 id="quick-add-title" className="quick-add-title">Add Word</h1>
            <p className="quick-add-subtitle">Learn something new</p>
          </div>
          <button
            type="button"
            className="quick-add-close"
            onClick={onClose}
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="1" y1="1" x2="13" y2="13"/><line x1="13" y1="1" x2="1" y2="13"/>
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="quick-add-content">
          
          {/* ============ FORM SECTION ============ */}
          <Section variant="form">
            {/* Word/Phrase Input + Enrich Button */}
            <div className="form-field">
              <div className="form-input-row">
                <div className="input-group quick-add-input-group" style={{ flex: 1 }}>
                  <input
                    ref={q.termRef}
                    className="input-field"
                    placeholder=" "
                    maxLength={255}
                    value={q.term}
                    onChange={(e) => q.setTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !q.enriching && !q.savePending) {
                        e.preventDefault()
                        if (enriched) q.save().catch(() => {})
                        else q.enrich()
                      }
                    }}
                    aria-label="Word or phrase"
                  />
                  <label className="input-label">Word or phrase</label>
                </div>
                <button
                  type="button"
                  className={`enrich-btn${q.enriching ? ' is-loading' : ''}`}
                  onClick={q.enrich}
                  disabled={!q.term.trim() || q.enriching}
                  aria-label="Enrich word with AI"
                  title="Get AI-powered definitions, examples, and more"
                >
                  {q.enriching ? (
                    <>
                      <span className="spinner"></span>
                      <span>Enriching…</span>
                    </>
                  ) : (
                    <>
                      <span>✨</span>
                      <span>Enrich</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Translation Input */}
            <div className="form-field">
              <div className="form-field-topline">
                <label className="form-label">Translation</label>
                {enriched && q.enrichResult!.translation_entries.length > 0 && (
                  <span className="form-field-status form-field-status-ok">✓ AI-filled</span>
                )}
              </div>
              <div className="input-group">
                <input
                  className={`input-field${enriched && q.enrichResult!.translation_entries.length > 0 ? ' is-success' : ''}`}
                  placeholder=" "
                  value={q.translation}
                  onChange={(e) => q.setTranslation(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !q.savePending) {
                      e.preventDefault()
                      q.save().catch(() => {})
                    }
                  }}
                  aria-label="Translation"
                />
                <label className="input-label">Translation</label>
              </div>
            </div>

            {/* Topic Selection */}
            <div className="form-field">
              <label className="form-label">Topic</label>
              {!q.addingTopic ? (
                <div className="form-topic-row">
                  <select
                    className="form-select"
                    value={q.topicId ?? ''}
                    onChange={(e) => q.setTopicId(Number(e.target.value))}
                    aria-label="Select topic"
                  >
                    {q.topicsLoading && <option value="">Loading…</option>}
                    {!q.topicsLoading && q.topicId === null && <option value="" disabled>📥 Inbox (default)</option>}
                    {q.sortedTopics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <button
                    type="button"
                    className="form-new-topic-btn"
                    onClick={() => q.setAddingTopic(true)}
                    aria-label="Create new topic"
                  >
                    + New Topic
                  </button>
                </div>
              ) : (
                <div className="form-topic-row">
                  <input
                    className="input-field"
                    placeholder="Topic name…"
                    value={q.newTopic}
                    autoFocus
                    maxLength={200}
                    onChange={(e) => q.setNewTopic(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation()
                      if (e.key === 'Enter' && !q.createTopicPending) {
                        e.preventDefault()
                        if (q.newTopic.trim()) q.createTopic()
                      }
                      if (e.key === 'Escape') q.cancelNewTopic()
                    }}
                    aria-label="New topic name"
                  />
                  <button
                    type="button"
                    className="form-create-btn"
                    disabled={!q.newTopic.trim() || q.createTopicPending}
                    onClick={q.createTopic}
                    aria-label="Create topic"
                  >
                    {q.createTopicPending ? '…' : 'Create'}
                  </button>
                  <button
                    type="button"
                    className="form-cancel-btn"
                    onClick={q.cancelNewTopic}
                    aria-label="Cancel new topic"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* Validation Feedback */}
            {q.feedback && (
              <div className={`form-feedback ${q.feedback.ok ? 'form-feedback-ok' : 'form-feedback-err'}`}>
                <span className="form-feedback-icon">{q.feedback.ok ? '✓' : '⚠'}</span>
                <span>{q.feedback.msg}</span>
              </div>
            )}
          </Section>

          {/* ============ ENRICHED CONTENT SECTION ============ */}
          {enriched && <EnrichedContentPreview result={q.enrichResult!} />}

        </div>

        {/* Footer with Actions */}
        <div className="quick-add-footer">
          <button
            type="button"
            className="quick-add-btn quick-add-btn-cancel"
            onClick={onClose}
            aria-label="Cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className="quick-add-btn quick-add-btn-primary"
            disabled={!q.canSave || q.savePending}
            onClick={q.save}
            aria-label={q.savePending ? 'Saving word…' : 'Save word'}
          >
            {q.savePending ? (
              <>
                <span className="spinner spinner-sm"></span>
                <span>Saving…</span>
              </>
            ) : (
              <>
                <span>✓</span>
                <span>Save Word</span>
              </>
            )}
          </button>
        </div>

        {/* Toast Notification */}
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

// ============ ENRICHED CONTENT COMPONENT ============

function EnrichedContentPreview({ result }: { result: import('@/features/words/types/wordTypes').EnrichResult }) {
  const chips: Array<{label: string; icon?: string; variant: string}> = []
  
  if (result.part_of_speech) chips.push({ label: result.part_of_speech, variant: 'feature' })
  if (result.cefr_level) chips.push({ label: result.cefr_level, icon: '🎓', variant: 'level' })
  if (result.register && result.register !== 'neutral') chips.push({ label: result.register, variant: 'feature' })
  if (result.countability) chips.push({ label: result.countability, variant: 'feature' })

  return (
    <Section icon="✨" title="Enrichment" subtitle="AI-powered insights" variant="content">
      
      {/* Tags/Badges */}
      {chips.length > 0 && (
        <div className="enrich-chips">
          {chips.map((chip) => (
            <Badge key={chip.label} variant={chip.variant} icon={chip.icon}>
              {chip.label}
            </Badge>
          ))}
        </div>
      )}

      {/* Definition */}
      {result.definition && (
        <div className="enrich-field">
          <h4 className="enrich-field-title">Definition</h4>
          <p className="enrich-field-value">{result.definition}</p>
        </div>
      )}

      {/* Pronunciation */}
      {result.pronunciation_ipa && (
        <div className="enrich-field">
          <h4 className="enrich-field-title">Pronunciation</h4>
          <code className="enrich-field-value enrich-ipa">{result.pronunciation_ipa}</code>
        </div>
      )}

      {/* Translations */}
      {result.translation_entries.length > 0 && (
        <div className="enrich-field">
          <h4 className="enrich-field-title">Translations</h4>
          <div className="enrich-list">
            {result.translation_entries.map((trans, i) => (
              <div key={i} className="enrich-list-item">{trans}</div>
            ))}
          </div>
        </div>
      )}

      {/* Examples */}
      {result.example_entries.length > 0 && (
        <div className="enrich-field">
          <h4 className="enrich-field-title">Examples</h4>
          <ul className="enrich-examples">
            {result.example_entries.map((ex, i) => (
              <li key={i} className="enrich-example-item">{ex}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Synonyms */}
      {result.synonym_entries.length > 0 && (
        <div className="enrich-field">
          <h4 className="enrich-field-title">Synonyms</h4>
          <div className="enrich-list">
            {result.synonym_entries.map((syn, i) => (
              <div key={i} className="enrich-list-item">{syn}</div>
            ))}
          </div>
        </div>
      )}

      {/* Antonyms */}
      {result.antonym_entries.length > 0 && (
        <div className="enrich-field">
          <h4 className="enrich-field-title">Antonyms</h4>
          <div className="enrich-list">
            {result.antonym_entries.map((ant, i) => (
              <div key={i} className="enrich-list-item">{ant}</div>
            ))}
          </div>
        </div>
      )}

      {/* Collocations */}
      {result.collocation_entries.length > 0 && (
        <div className="enrich-field">
          <h4 className="enrich-field-title">Common Collocations</h4>
          <div className="enrich-list">
            {result.collocation_entries.map((coll, i) => (
              <div key={i} className="enrich-list-item">{coll}</div>
            ))}
          </div>
        </div>
      )}
    </Section>
  )
}
```

---

## 4. CSS Modernization (quick-add.css)

### 4.1 Modal Container & Overlay

```css
.quick-add-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 40;
  animation: fade-in 0.2s ease-out;
}

.quick-add-sheet {
  position: fixed;
  bottom: 0;
  right: 0;
  width: 420px;
  height: 100%;
  background: var(--surface);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  z-index: 41;
  animation: sheet-slide-in 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: -2px 0 20px rgba(0, 0, 0, 0.1);
}

@keyframes sheet-slide-in {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@media (max-width: 768px) {
  .quick-add-sheet {
    width: 100%;
    border-left: none;
    border-top: 1px solid var(--border);
    border-radius: 20px 20px 0 0;
  }
}
```

### 4.2 Header

```css
.quick-add-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 24px 24px 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.quick-add-header-content {
  flex: 1;
}

.quick-add-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text);
  line-height: 1.2;
}

.quick-add-subtitle {
  margin: 4px 0 0;
  font-size: 0.9rem;
  color: var(--text-3);
  font-weight: 400;
}

.quick-add-close {
  background: none;
  border: none;
  color: var(--text-3);
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.quick-add-close:hover {
  color: var(--text);
  background: rgba(0, 0, 0, 0.05);
  border-radius: var(--radius-sm);
}
```

### 4.3 Content Container (Scrollable)

```css
.quick-add-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  
  /* Custom scrollbar */
  scrollbar-width: thin;
  scrollbar-color: rgba(99, 102, 241, 0.3) transparent;
}

.quick-add-content::-webkit-scrollbar {
  width: 6px;
}

.quick-add-content::-webkit-scrollbar-track {
  background: transparent;
}

.quick-add-content::-webkit-scrollbar-thumb {
  background: rgba(99, 102, 241, 0.3);
  border-radius: 3px;
}

.quick-add-content::-webkit-scrollbar-thumb:hover {
  background: rgba(99, 102, 241, 0.5);
}
```

### 4.4 Section Styling

```css
.section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.section-icon {
  font-size: 1.4rem;
  line-height: 1;
  flex-shrink: 0;
}

.section-titles {
  flex: 1;
}

.section-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
}

.section-subtitle {
  margin: 2px 0 0;
  font-size: 0.8rem;
  color: var(--text-3);
}

.section-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Form Section Styling */
.section-form {
  background: rgba(99, 102, 241, 0.02);
  padding: 20px;
  border-radius: var(--radius-lg);
  border: 1px solid rgba(99, 102, 241, 0.1);
}

.section-form .section-header {
  display: none; /* Hide header in form section */
}
```

### 4.5 Form Fields

```css
.form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-input-row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.form-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-2);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin: 0;
}

.form-field-topline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.form-field-status {
  font-size: 0.75rem;
  color: #059669;
  font-weight: 600;
}

.form-field-status-ok {
  color: #059669;
}

/* Input Group (shared floating label) */
.input-group {
  position: relative;
  display: flex;
  flex-direction: column;
}

.input-field {
  padding: 12px 16px;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text);
  font-size: 0.95rem;
  font-family: inherit;
  transition: all 0.2s ease;
  outline: none;
}

.input-field:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  background: var(--surface);
}

.input-field.is-success {
  border-color: #059669;
  background: rgba(16, 185, 129, 0.03);
}

.input-label {
  position: absolute;
  top: 12px;
  left: 16px;
  font-size: 0.95rem;
  color: var(--text-3);
  pointer-events: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: left center;
}

.input-field:focus ~ .input-label,
.input-field:not(:placeholder-shown) ~ .input-label {
  transform: translateY(-28px) scale(0.85);
  color: var(--accent);
  font-weight: 500;
}

/* Enrich Button */
.enrich-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px;
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  min-width: fit-content;
}

.enrich-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.3);
}

.enrich-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.enrich-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.enrich-btn.is-loading {
  position: relative;
  color: transparent;
  pointer-events: none;
}

.enrich-btn.is-loading .spinner {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

/* Spinner */
.spinner {
  display: inline-flex;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner-sm {
  width: 14px;
  height: 14px;
  border-width: 1.5px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Topic Select & Buttons */
.form-select {
  padding: 12px 16px;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text);
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s ease;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpolyline points='1 1 6 6 11 1'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 36px;
}

.form-select:hover,
.form-select:focus {
  border-color: var(--accent);
  outline: none;
}

.form-topic-row {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.form-new-topic-btn,
.form-create-btn,
.form-cancel-btn {
  padding: 12px 16px;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-2);
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.form-new-topic-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(99, 102, 241, 0.05);
}

.form-create-btn {
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  border-color: #6366f1;
  color: white;
}

.form-create-btn:hover:not(:disabled) {
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
}

.form-create-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.form-cancel-btn {
  padding: 12px;
  min-width: 44px;
}

.form-cancel-btn:hover {
  border-color: #ef4444;
  color: #ef4444;
  background: rgba(239, 68, 68, 0.05);
}

/* Form Feedback */
.form-feedback {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  animation: slide-up 0.3s ease-out;
}

@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.form-feedback-ok {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #059669;
}

.form-feedback-err {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #b91c1c;
}

.form-feedback-icon {
  flex-shrink: 0;
  font-weight: 600;
}
```

### 4.6 Badges Styling

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
}

.badge-icon {
  font-size: 0.9rem;
  line-height: 1;
}

.badge-text {
  line-height: 1.2;
}

.badge-level {
  background: linear-gradient(135deg, #e0e7ff 0%, #ddd6fe 100%);
  color: #4338ca;
  border: 1px solid #c7d2fe;
}

.badge-feature {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  color: #0c4a6e;
  border: 1px solid #93c5fd;
}

.badge-info {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  color: #92400e;
  border: 1px solid #fcd34d;
}

/* Dark mode badges */
:root[color-scheme="dark"] .badge-level {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(79, 70, 229, 0.15) 100%);
  color: #a5b4fc;
  border-color: rgba(99, 102, 241, 0.3);
}

:root[color-scheme="dark"] .badge-feature {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.15) 100%);
  color: #93c5fd;
  border-color: rgba(59, 130, 246, 0.3);
}

:root[color-scheme="dark"] .badge-info {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(245, 158, 11, 0.15) 100%);
  color: #fcd34d;
  border-color: rgba(251, 191, 36, 0.3);
}
```

### 4.7 Enriched Content Styling

```css
.enrich-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.enrich-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}

.enrich-field:last-child {
  border-bottom: none;
}

.enrich-field-title {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-2);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.enrich-field-value {
  margin: 0;
  font-size: 0.95rem;
  color: var(--text);
  line-height: 1.6;
}

.enrich-ipa {
  font-size: 0.85rem;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.03);
  border-radius: var(--radius-sm);
  color: var(--accent);
}

.enrich-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.enrich-list-item {
  padding: 6px 0 6px 20px;
  position: relative;
  font-size: 0.95rem;
  color: var(--text);
  line-height: 1.5;
}

.enrich-list-item::before {
  content: '•';
  position: absolute;
  left: 0;
  color: var(--accent);
  font-weight: bold;
}

.enrich-examples {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.enrich-example-item {
  padding: 10px 12px;
  background: rgba(99, 102, 241, 0.05);
  border-left: 3px solid var(--accent);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  font-size: 0.9rem;
  color: var(--text);
  font-style: italic;
  line-height: 1.5;
}
```

### 4.8 Footer

```css
.quick-add-footer {
  display: flex;
  gap: 12px;
  padding: 16px 24px 24px;
  border-top: 1px solid var(--border);
  background: var(--surface);
  flex-shrink: 0;
}

.quick-add-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
}

.quick-add-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.quick-add-btn-cancel {
  background: transparent;
  color: var(--text-2);
  border: 1.5px solid var(--border);
}

.quick-add-btn-cancel:hover {
  border-color: var(--text-2);
  background: rgba(0, 0, 0, 0.03);
}

.quick-add-btn-primary {
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  color: white;
}

.quick-add-btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(99, 102, 241, 0.3);
}

.quick-add-btn-primary:active:not(:disabled) {
  transform: scale(0.98);
}

.quick-add-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.quick-add-btn-primary.is-loading {
  position: relative;
  color: transparent;
  pointer-events: none;
}
```

### 4.9 Mobile Responsive

```css
@media (max-width: 640px) {
  .quick-add-sheet {
    width: 100%;
    height: auto;
    max-height: 90vh;
    border-radius: 20px 20px 0 0;
    border-top: 1px solid var(--border);
    border-left: none;
  }

  .quick-add-header {
    padding: 20px 20px 16px;
  }

  .quick-add-title {
    font-size: 1.3rem;
  }

  .quick-add-content {
    padding: 20px;
    gap: 20px;
  }

  .quick-add-footer {
    padding: 16px 20px 24px;
    flex-direction: column;
    gap: 10px;
  }

  .quick-add-btn {
    width: 100%;
  }

  .form-input-row {
    flex-direction: column;
    align-items: stretch;
  }

  .enrich-btn {
    width: 100%;
    justify-content: center;
  }

  .form-topic-row {
    flex-direction: column;
  }

  .form-select,
  .form-new-topic-btn,
  .form-create-btn,
  .form-cancel-btn {
    width: 100%;
  }
}
```

---

## 5. Implementation Checklist

### Step 1: Create New Components
- [ ] Create `frontend/src/shared/components/Badge.tsx`
- [ ] Create `frontend/src/shared/components/Section.tsx`

### Step 2: Update QuickAddSheet
- [ ] Redesign JSX structure with new Section components
- [ ] Add EnrichedContentPreview component
- [ ] Wire up state and callbacks
- [ ] Test enrichment flow

### Step 3: CSS Implementation
- [ ] Add all new `.quick-add-*` classes to `quick-add.css`
- [ ] Add `.badge-*` styling
- [ ] Add `.section-*` styling
- [ ] Add `.form-*` styling
- [ ] Add `.enrich-*` styling
- [ ] Add animations (@keyframes)
- [ ] Add dark mode support
- [ ] Add mobile responsive styles

### Step 4: Validation Testing

#### 5.1 Layout & Visual Hierarchy (Desktop)
- [ ] Modal 420px wide on right side of screen
- [ ] Header with title + close button (clear, spacious)
- [ ] Form section clearly distinguished (light background)
- [ ] Enrich button visible and prominent (gradient)
- [ ] Enriched content section separate with icon + title
- [ ] Badges display tags with good spacing
- [ ] Footer buttons prominent and spaced
- [ ] Content scrolls smoothly when tall
- [ ] No text overflow or layout shifts

#### 5.2 Form Interactions
- [ ] Focus on word input → focus-visible, floating label shifts up
- [ ] Typing word → label stays up
- [ ] Click Enrich → button shows loading spinner (…)
- [ ] Enrichment complete → content appears smoothly (animation)
- [ ] Translation auto-filled → shows "✓ AI-filled" badge
- [ ] Topic dropdown works, can create new topic
- [ ] Form validation feedback displays correctly (error/success)
- [ ] Enter key saves word when form valid
- [ ] All inputs have proper aria-labels

#### 5.3 Loading States
- [ ] Enrich button shows spinner during enrichment
- [ ] "Enriching…" text appears
- [ ] Save button shows spinner during save
- [ ] "Saving…" text appears
- [ ] Buttons disabled during loading
- [ ] Visual feedback clear (no ambiguity)

#### 5.4 Light Mode
- [ ] Form section: light blue background (rgba(99, 102, 241, 0.02))
- [ ] Form section: subtle border (rgba(99, 102, 241, 0.1))
- [ ] Badges: colored backgrounds with good contrast
- [ ] Enriched content fields: readable, clear hierarchy
- [ ] Text colors: sufficient contrast (WCAG AA)

#### 5.5 Dark Mode
- [ ] Form section: visible on dark surface
- [ ] Badges: colors work on dark background
- [ ] Text colors: sufficient contrast
- [ ] Input fields: visible focus states
- [ ] Scrollbar styled appropriately

#### 5.6 Mobile (≤640px)
- [ ] Modal full-width with rounded top corners
- [ ] Header accessible, close button easy to tap
- [ ] Form fields stack vertically
- [ ] Enrich button full-width
- [ ] Topic row stacks vertically
- [ ] Footer buttons stack vertically
- [ ] Content scrolls smoothly
- [ ] All tap targets ≥44px

#### 5.7 Animations
- [ ] Modal slides in from right (desktop) / bottom (mobile)
- [ ] Overlay fades in
- [ ] Content appears smoothly (no jank)
- [ ] Feedback message slides up
- [ ] Loading spinner rotates smoothly
- [ ] All animations respect prefers-reduced-motion

#### 5.8 Accessibility
- [ ] All inputs have labels (visible or aria-label)
- [ ] Focus order logical (top to bottom)
- [ ] Buttons keyboard accessible (Enter, Space)
- [ ] Escape closes modal
- [ ] Screen reader announces modal title and purpose
- [ ] Form validation messages read aloud
- [ ] Loading states announced

#### 5.9 Edge Cases
- [ ] Long word names → no overflow
- [ ] Long translations → display correctly
- [ ] Many badges → wrap and align properly
- [ ] Long definition text → readable, no layout break
- [ ] Many examples → scroll within section
- [ ] No enrichment data → graceful empty state (section hidden)
- [ ] Network error during enrich → error message shown, user can retry
- [ ] Form submission error → feedback displayed, can retry

---

## 6. Expected Results

### Before
```
┌─ Add word ─────────────────────┐
│ Word: [input]  [Enrich ✨]     │
│ Translation: [input]           │
│ Topic: [dropdown]              │
│ ─────────────────────────────  │
│ A2 | Countable | English       │
│ Definition: Lorem ipsum...     │
│ Pronunciation: /…/            │
│ Examples: …                    │
│ Synonyms: …                    │
│ [Cancel] [Add word]            │
└────────────────────────────────┘
```

### After
```
┌─ Add Word ─────────────────────────┐
│ Learn something new         [✕]   │
├────────────────────────────────────┤
│ ┌─ FORM SECTION ─────────────────┐ │
│ │ Word/Phrase:                   │ │
│ │ [input]           [✨ Enrich]  │ │
│ │                                │ │
│ │ Translation: ✓ AI-filled       │ │
│ │ [input]                        │ │
│ │                                │ │
│ │ Topic:                         │ │
│ │ [dropdown] [+ New Topic]       │ │
│ │                                │ │
│ │ ✓ Word saved successfully      │ │
│ └────────────────────────────────┘ │
│                                    │
│ ✨ Enrichment                      │
│ AI-powered insights               │
│ A2 | 🎓 CEFR | Countable | Noun  │
│                                    │
│ Definition                         │
│ Lorem ipsum dolor sit amet...     │
│                                    │
│ Pronunciation                     │
│ /ɪɡˈzæmpəl/                      │
│                                    │
│ Translations                       │
│ • пример                          │
│ • образец                         │
│                                    │
│ Examples                           │
│ ┌─ This is an example sentence.   │
│ └─ Another example here.          │
│                                    │
│ Synonyms                           │
│ • instance, specimen, sample      │
│ ─────────────────────────────────  │
│ [Cancel]  [✓ Save Word]           │
└────────────────────────────────────┘
```

**Key Improvements:**
✓ Clear visual separation (form vs enriched content)
✓ Better spacing & breathing room
✓ Modern floating labels on inputs
✓ Loading states with spinners
✓ Clear visual hierarchy (titles, sections, emphasis)
✓ Beautiful badge styling with colors
✓ Organized enriched content (Definition → Pronunciation → Examples)
✓ Smooth animations on entry
✓ Accessible (labels, focus, keyboard navigation)
✓ Responsive mobile design
✓ Dark mode support

---

## 7. Implementation Order
1. Create Badge and Section components
2. Update QuickAddSheet JSX structure
3. Add CSS styling (all .quick-add-* classes)
4. Test form interactions and enrichment flow
5. Test loading states and animations
6. Validate responsive design (mobile)
7. Test dark mode and light mode
8. Accessibility audit (keyboard, screen reader)
9. Test edge cases (long content, errors)

Estimated time: 3–4 hours for full implementation + testing.
