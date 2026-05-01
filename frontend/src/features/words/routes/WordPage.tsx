import {useEffect, useState} from 'react'
import {useNavigate, useLocation} from 'react-router-dom'
import {routes} from '@/app/routes'
import {LEVEL_LABELS, levelClass} from '@/features/words/model/wordDomain'
import {ConfirmModal} from '@/shared/ui/ConfirmModal'
import {NotFoundPage} from '@/app/layout/NotFoundPage'
import {usePublicConfig} from '@/shared/config/usePublicConfig'
import {useWordPageState} from '@/features/words/hooks/useWordPageState'
import {WordPageEditForm} from '@/features/words/components/WordPageEditForm'
import {WordPageView} from '@/features/words/components/WordPageView'
import type {Word} from '@/features/words/types/wordTypes'

type WordWithPronunciation = Word & {
  ipa?: string | null
  pronunciation?: string | null
  phonetic?: string | null
  ipa_pronunciation?: string | null
}

function resolvePronunciation(word: Word): string | null {
  const candidate = word as WordWithPronunciation
  for (const value of [candidate.ipa, candidate.ipa_pronunciation, candidate.pronunciation, candidate.phonetic]) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function WordPageSkeleton() {
  const rows = [75, 55, 90, 60, 40]
  return (
    <div className="word-page">
      <div className="word-page-hero-wrap">
        <div className="word-page-topbar">
          <div className="sk" style={{width: 48, height: 14}} />
          <div className="sk" style={{width: 38, height: 14}} />
        </div>
        <div className="sk" style={{height: 122, borderRadius: 'var(--radius-lg)'}} />
      </div>
      <div className="word-page-inner">
        <div className="sk-rows">
          {rows.map((w, i) => (
            <div key={i} style={{display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, padding: '14px 20px', borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center'}}>
              <div className="sk" style={{height: 11, width: 70}} />
              <div className="sk" style={{height: 14, width: `${w}%`}} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function WordPage() {
  const s = useWordPageState()
  const publicConfigQuery = usePublicConfig()
  const navigate = useNavigate()
  const location = useLocation()
  const [isSpeaking, setIsSpeaking] = useState(false)

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  if (s.isInvalidWordId) return <NotFoundPage />
  if (s.isLoading) return <WordPageSkeleton />
  if (!s.word) return <div className="word-page-loading">Word not found.</div>

  const {word, topics, topic, draft, set, editing} = s
  const lc = levelClass(word.knowledge_level)
  const pronunciation = resolvePronunciation(word)
  const hasSpeechSynthesis = typeof window !== 'undefined' && 'speechSynthesis' in window
  const backRoute = topic?.slug
    ? routes.topic(topic.slug)
    : s.fromTopicSlug
      ? routes.topic(s.fromTopicSlug)
      : routes.home
  const trashRetentionDays = publicConfigQuery.data?.trash_retention_days ?? 30

  function handleSpeak() {
    if (!hasSpeechSynthesis || !word.term.trim()) return

    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(word.term)
    utterance.lang = 'en-GB'
    utterance.rate = 0.92
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    window.speechSynthesis.speak(utterance)
  }

  return (
    <div className="word-page">

      <div className="word-page-hero-wrap">
        <div className="word-page-topbar">
          <button
            type="button"
            className="word-page-back-btn"
            onClick={() => editing
              ? navigate(routes.word(s.wordId), {replace: true, state: location.state})
              : navigate(backRoute)}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="9,2 4,7 9,12" />
            </svg>
            Back
          </button>
          {!editing && (
            <button type="button" className="word-page-edit-btn" onClick={() => navigate(routes.editWord(s.wordId), {state: location.state})}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z" />
              </svg>
              Edit
            </button>
          )}
        </div>
        <div className={`word-page-hero ${lc}`}>
          <div className="word-page-hero-meta">
            <span className="word-page-level-chip">
              {word.knowledge_level ? `Level ${word.knowledge_level} — ${LEVEL_LABELS[word.knowledge_level]}` : 'Unrated word'}
            </span>
            {topic && <span className="word-page-topic-chip">{topic.name}</span>}
          </div>
          <h1 className="word-page-term">{word.term}</h1>
          <div className="word-page-pronunciation-row">
            <p className={`word-page-pronunciation${pronunciation ? '' : ' is-muted'}`}>
              {pronunciation ?? 'Pronunciation unavailable'}
            </p>
            <button
              type="button"
              className="word-page-pronounce-btn"
              onClick={handleSpeak}
              disabled={!hasSpeechSynthesis}
              aria-label={`Play pronunciation for ${word.term}`}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 6h3l4-3v10l-4-3H3z" />
                <path d="M12.2 5.2a4 4 0 0 1 0 5.6" />
              </svg>
              {isSpeaking ? 'Playing…' : 'Pronounce'}
            </button>
          </div>
        </div>
      </div>

      <div className="word-page-inner">
        {!editing && <WordPageView word={word} topics={topics} />}

        {editing && draft && (
          <WordPageEditForm
            draft={draft}
            topics={topics}
            saveError={s.saveError}
            savePending={s.savePending}
            onFieldChange={set}
            onClearError={() => s.setSaveError(null)}
            onDelete={() => s.setConfirming(true)}
            onCancel={() => {
              navigate(routes.word(s.wordId), {replace: true, state: location.state})
              s.setSaveError(null)
            }}
            onSave={s.save}
          />
        )}
      </div>

      {!editing && (
        <div className="word-page-footer">
          <button type="button" className="word-page-nav-btn" disabled={!s.prevWord} onClick={() => s.prevWord && navigate(routes.word(s.prevWord.id), {state: location.state})}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9,2 4,7 9,12" /></svg>
            Prev
          </button>
          <span className="word-page-nav-pos">{s.currentIdx >= 0 ? `${s.currentIdx + 1} / ${s.topicWords.length}` : ''}</span>
          <button type="button" className="word-page-nav-btn word-page-nav-btn-next" disabled={!s.nextWord} onClick={() => s.nextWord && navigate(routes.word(s.nextWord.id), {state: location.state})}>
            Next
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="5,2 10,7 5,12" /></svg>
          </button>
        </div>
      )}

      {s.confirming && (
        <ConfirmModal
          title="Move to Trash?"
          message={`"${word.term}" will be moved to Trash and permanently deleted after ${trashRetentionDays} days.`}
          confirmLabel="Move to Trash"
          danger
          pending={s.deletePending}
          onConfirm={s.handleDelete}
          onCancel={() => s.setConfirming(false)}
        />
      )}
    </div>
  )
}
