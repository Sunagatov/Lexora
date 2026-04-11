import {useEffect, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {fetchTopics, createTopic} from '../topics/api'
import {quickAddWord} from '../words/api'
import {request} from '../../shared/http'
import type {Topic} from '../../shared/http'
import {slugify} from '../../shared/slugify'

const INBOX_TOPIC_NAME = 'Inbox'

async function translateTerm(term: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(term)}&langpair=en|ru`,
    )
    if (!res.ok) return null
    const data = await res.json()
    const text = data?.responseData?.translatedText
    return text && text.toLowerCase() !== term.toLowerCase() ? text : null
  } catch {
    return null
  }
}

async function suggestTopic(term: string, translation: string): Promise<string | null> {
  try {
    const res = await request<{topic_name: string}>('/api/words/suggest-topic', {
      method: 'POST',
      body: JSON.stringify({term, translation}),
    })
    return res.topic_name ?? null
  } catch {
    return null
  }
}

type Props = {onClose: () => void}

export function QuickAddSheet({onClose}: Props) {
  const queryClient = useQueryClient()
  const termRef     = useRef<HTMLInputElement>(null)

  const [term,        setTerm]        = useState('')
  const [translation, setTranslation] = useState('')
  const [topicId,     setTopicId]     = useState<number | null>(null)
  const [newTopic,    setNewTopic]    = useState('')
  const [addingTopic, setAddingTopic] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [suggesting,  setSuggesting]  = useState(false)
  const [aiSuggested, setAiSuggested] = useState(false)
  const [feedback,    setFeedback]    = useState<{ok: boolean; msg: string} | null>(null)

  const topicsQuery = useQuery({queryKey: ['topics'], queryFn: fetchTopics})
  const topics: Topic[] = topicsQuery.data ?? []

  // Default to Inbox topic id once topics load.
  // If Inbox doesn't exist yet, still default topicId to null but
  // show Inbox as the first option — it will be created on first save.
  useEffect(() => {
    if (topicId !== null || topics.length === 0) return
    const inbox = topics.find((t) => t.name === INBOX_TOPIC_NAME)
    if (inbox) setTopicId(inbox.id)
  }, [topics, topicId])

  // Ensure Inbox topic exists, creating it if needed. Returns its id.
  async function ensureInbox(): Promise<number | null> {
    const existing = topics.find((t) => t.name === INBOX_TOPIC_NAME)
    if (existing) return existing.id
    try {
      const created = await createTopic(INBOX_TOPIC_NAME, slugify(INBOX_TOPIC_NAME))
      queryClient.invalidateQueries({queryKey: ['topics']})
      return created.id
    } catch {
      return null
    }
  }

  useEffect(() => { setTimeout(() => termRef.current?.focus(), 80) }, [])

  const addWordMutation = useMutation({
    mutationFn: (resolvedTopicId: number) => quickAddWord(term.trim(), translation.trim(), [resolvedTopicId]),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['words']})
      setFeedback({ok: true, msg: `"${term.trim()}" saved!`})
      setTerm('')
      setTranslation('')
      setAiSuggested(false)
      setTimeout(() => { setFeedback(null); termRef.current?.focus() }, 1800)
    },
    onError: (err: Error) => {
      const msg = err.message.includes('409') || err.message.includes('already')
        ? `"${term.trim()}" already exists in this topic`
        : 'Failed to save. Try again.'
      setFeedback({ok: false, msg})
    },
  })

  const createTopicMutation = useMutation({
    mutationFn: () => createTopic(newTopic.trim(), slugify(newTopic.trim())),
    onSuccess: (created) => {
      queryClient.invalidateQueries({queryKey: ['topics']})
      setTopicId(created.id)
      setNewTopic('')
      setAddingTopic(false)
    },
    onError: () => setFeedback({ok: false, msg: 'Could not create topic — name may already exist.'}),
  })

  async function handleTranslateOnly() {
    if (!term.trim()) {
      setFeedback({ok: false, msg: 'Enter a word first.'})
      termRef.current?.focus()
      return
    }
    setTranslating(true)
    setFeedback(null)
    const result = await translateTerm(term.trim())
    setTranslating(false)
    if (result) {
      setTranslation(result)
    } else {
      setFeedback({ok: false, msg: 'Translation not found — please enter it manually.'})
    }
  }

  async function handleSuggestOnly() {
    if (!term.trim()) {
      setFeedback({ok: false, msg: 'Enter a word first.'})
      termRef.current?.focus()
      return
    }
    if (!translation.trim()) {
      setFeedback({ok: false, msg: 'Enter a translation first so AI can suggest a topic.'})
      return
    }
    setSuggesting(true)
    setFeedback(null)
    const suggested = await suggestTopic(term.trim(), translation.trim())
    setSuggesting(false)
    if (suggested) {
      const match = topics.find((t) => t.name === suggested)
      if (match) {
        setTopicId(match.id)
        setAiSuggested(true)
      } else {
        setFeedback({ok: false, msg: `AI suggested "${suggested}" but it wasn’t found in your topics.`})
      }
    } else {
      setFeedback({ok: false, msg: 'Could not suggest a topic — please select one manually.'})
    }
  }

  async function handleAutoFill() {
    if (!term.trim()) {
      setFeedback({ok: false, msg: 'Enter a word first.'})
      termRef.current?.focus()
      return
    }
    setFeedback(null)

    // Step 1: translate
    setTranslating(true)
    const result = await translateTerm(term.trim())
    setTranslating(false)
    if (!result) {
      setFeedback({ok: false, msg: 'Translation not found — please enter it manually.'})
      return
    }
    setTranslation(result)

    // Step 2: suggest topic
    setSuggesting(true)
    const suggested = await suggestTopic(term.trim(), result)
    setSuggesting(false)
    if (suggested) {
      const match = topics.find((t) => t.name === suggested)
      if (match) {
        setTopicId(match.id)
        setAiSuggested(true)
      }
    }
  }

  async function handleSave() {
    if (!term.trim()) {
      setFeedback({ok: false, msg: 'Word or phrase is required.'})
      termRef.current?.focus()
      return
    }
    if (!translation.trim()) {
      setFeedback({ok: false, msg: 'Translation is required.'})
      return
    }
    setFeedback(null)

    // Resolve topic: use selected, or auto-create Inbox
    let resolvedTopicId = topicId
    if (!resolvedTopicId) {
      const inboxId = await ensureInbox()
      if (!inboxId) {
        setFeedback({ok: false, msg: 'Could not create Inbox topic. Please select a topic manually.'})
        return
      }
      setTopicId(inboxId)
      resolvedTopicId = inboxId
    }

    // Pass resolvedTopicId directly — avoids stale closure on topicId state
    addWordMutation.mutate(resolvedTopicId)
  }

  // Only handle Escape at sheet level — do NOT intercept Enter here,
  // each input handles its own Enter to avoid propagation conflicts
  function handleSheetKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose()
  }

  const canSave = term.trim().length > 0 && translation.trim().length > 0 && !addWordMutation.isPending

  // Sort topics: Inbox first, rest alphabetical
  const sortedTopics = [
    ...topics.filter((t) => t.name === INBOX_TOPIC_NAME),
    ...topics.filter((t) => t.name !== INBOX_TOPIC_NAME).sort((a, b) => a.name.localeCompare(b.name)),
  ]

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
          {/* Term */}
          <div className="quick-add-field">
            <label className="quick-add-label">Word or phrase</label>
            <input
              ref={termRef}
              className="quick-add-input"
              placeholder="e.g. ephemeral"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave().catch(() => {}) } }}
            />
            <div className="quick-add-actions-row">
              <button
                type="button"
                className="quick-add-action-btn quick-add-action-btn-primary"
                onClick={handleAutoFill}
                disabled={!term.trim() || translating || suggesting}
                title="Translate + suggest topic automatically"
              >
                {translating ? 'Translating…' : suggesting ? 'Suggesting…' : '✨ Auto-fill'}
              </button>
              <button
                type="button"
                className="quick-add-action-btn"
                onClick={handleTranslateOnly}
                disabled={!term.trim() || translating || suggesting}
                title="Translate only"
              >
                Translate
              </button>
              <button
                type="button"
                className="quick-add-action-btn"
                onClick={handleSuggestOnly}
                disabled={!term.trim() || suggesting || translating}
                title="Suggest topic based on word and translation"
              >
                {suggesting ? '…' : 'Suggest topic'}
              </button>
            </div>
          </div>

          {/* Translation */}
          <div className="quick-add-field">
            <label className="quick-add-label">Translation</label>
            <input
              className="quick-add-input"
              placeholder="e.g. недолговечный"
              value={translation}
              onChange={(e) => { setTranslation(e.target.value); setAiSuggested(false) }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave().catch(() => {}) } }}
            />
          </div>

          {/* Topic */}
          <div className="quick-add-field">
            <label className="quick-add-label">Topic {aiSuggested && <span className="quick-add-ai-badge">✨ AI suggested</span>}</label>
            {!addingTopic ? (
              <div className="quick-add-topic-row">
                <select
                  className="quick-add-select"
                  value={topicId ?? ''}
                  onChange={(e) => { setTopicId(Number(e.target.value)); setAiSuggested(false) }}
                >
                  {topicsQuery.isLoading && <option value="">Loading…</option>}
                  {!topicsQuery.isLoading && topicId === null && (
                    <option value="" disabled>📥 Inbox (default)</option>
                  )}
                  {sortedTopics.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <button type="button" className="quick-add-new-topic-btn" onClick={() => setAddingTopic(true)}>
                  + New
                </button>
              </div>
            ) : (
              <div className="quick-add-topic-row">
                <input
                  className="quick-add-input"
                  placeholder="New topic name…"
                  value={newTopic}
                  autoFocus
                  maxLength={200}
                  onChange={(e) => setNewTopic(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation() // prevent sheet-level Escape from closing sheet while typing
                    if (e.key === 'Enter') { e.preventDefault(); if (newTopic.trim()) createTopicMutation.mutate() }
                    if (e.key === 'Escape') { setAddingTopic(false); setNewTopic('') }
                  }}
                />
                <button
                  type="button"
                  className="quick-add-translate-btn"
                  disabled={!newTopic.trim() || createTopicMutation.isPending}
                  onClick={() => createTopicMutation.mutate()}
                >
                  {createTopicMutation.isPending ? '…' : 'Create'}
                </button>
                <button
                  type="button"
                  className="quick-add-close"
                  onClick={() => { setAddingTopic(false); setNewTopic('') }}
                  aria-label="Cancel new topic"
                >
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <line x1="1" y1="1" x2="13" y2="13"/><line x1="13" y1="1" x2="1" y2="13"/>
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Feedback */}
          {feedback && (
            <div className={`quick-add-feedback ${feedback.ok ? 'quick-add-feedback-ok' : 'quick-add-feedback-err'}`}>
              {feedback.msg}
            </div>
          )}
        </div>

        <div className="quick-add-footer">
          <button type="button" className="quick-add-cancel" onClick={onClose}>Cancel</button>
          <button type="button" className="quick-add-save" disabled={!canSave} onClick={handleSave}>
            {addWordMutation.isPending ? 'Saving…' : 'Save word'}
          </button>
        </div>
      </div>
    </>,
    document.body,
  )
}
