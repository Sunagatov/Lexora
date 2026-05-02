import {useEffect, useState} from 'react'
import {Link, useNavigate} from 'react-router-dom'
import {useQuery} from '@tanstack/react-query'
import {fetchWord} from '@/features/words/api/wordsApi'
import {fetchTopics} from '@/features/topics/api/topicsApi'
import {queryKeys} from '@/app/queryKeys'
import {routes} from '@/app/routes'
import {WordPageView} from '@/features/words/components/WordPageView'
import {LEVEL_LABELS, levelClass} from '@/features/words/model/wordDomain'
import type {Word} from '@/features/words/types/wordTypes'

type Props = {
  wordId: number
  words: Word[]
  fromTopicSlug?: string
  onClose: () => void
  onNavigate: (id: number) => void
}

function getMainTranslation(word: Word): string {
  if (word.translation_entries.length) {
    return word.translation_entries.slice(0, 2).join(' · ')
  }
  return ''
}

export function WordDetailPanel({wordId, words, fromTopicSlug, onClose, onNavigate}: Props) {
  const navigate = useNavigate()
  const [isSpeaking, setIsSpeaking] = useState(false)

  const wordQuery = useQuery({
    queryKey: queryKeys.word(wordId),
    queryFn: () => fetchWord(wordId),
  })
  const topicsQuery = useQuery({
    queryKey: queryKeys.topics,
    queryFn: fetchTopics,
  })

  const word = wordQuery.data
  const topics = topicsQuery.data ?? []

  const currentIdx = words.findIndex((w) => w.id === wordId)
  const prevWord = currentIdx > 0 ? words[currentIdx - 1] : null
  const nextWord = currentIdx >= 0 && currentIdx < words.length - 1 ? words[currentIdx + 1] : null

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && prevWord) onNavigate(prevWord.id)
      if (e.key === 'ArrowRight' && nextWord) onNavigate(nextWord.id)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, prevWord, nextWord, onNavigate])

  useEffect(() => {
    setIsSpeaking(false)
    return () => { window.speechSynthesis?.cancel() }
  }, [wordId])

  function handleSpeak() {
    if (!word?.term.trim()) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(word.term)
    utterance.lang = 'en-GB'
    utterance.rate = 0.92
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }

  const hasSpeechSynthesis = typeof window !== 'undefined' && 'speechSynthesis' in window
  const lc = word ? levelClass(word.knowledge_level) : ''

  return (
    <aside className="word-detail-panel" aria-label="Word details">

      {/* ── Topbar ── */}
      <div className="word-detail-panel-topbar">
        <button type="button" className="wdp-icon-btn" onClick={onClose} aria-label="Close">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="1" y1="1" x2="13" y2="13"/><line x1="13" y1="1" x2="1" y2="13"/>
          </svg>
        </button>

        <div className="wdp-nav">
          <button type="button" className="wdp-nav-btn" disabled={!prevWord}
            onClick={() => prevWord && onNavigate(prevWord.id)} aria-label="Previous">
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <polyline points="9,2 4,7 9,12"/>
            </svg>
          </button>
          <span className="wdp-nav-pos">{currentIdx >= 0 ? `${currentIdx + 1} / ${words.length}` : ''}</span>
          <button type="button" className="wdp-nav-btn" disabled={!nextWord}
            onClick={() => nextWord && onNavigate(nextWord.id)} aria-label="Next">
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <polyline points="5,2 10,7 5,12"/>
            </svg>
          </button>
        </div>

        <span className="wdp-kbd-hint">esc · ←→</span>

        <div className="wdp-actions">
          {word && (
            <button type="button" className="wdp-edit-btn"
              onClick={() => navigate(routes.editWord(wordId), {state: {fromTopicSlug}})}>
              Edit
            </button>
          )}
          <Link className="wdp-icon-btn" to={routes.word(wordId)} state={{fromTopicSlug}} title="Open full page">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2H2v10h10V8"/><path d="M9 2h3v3"/><path d="M7 7l5-5"/>
            </svg>
          </Link>
        </div>
      </div>

      {wordQuery.isLoading ? (
        <div className="wdp-loading">Loading…</div>
      ) : !word ? (
        <div className="wdp-loading">Word not found.</div>
      ) : (
        <>
          {/* ── Hero ── */}
          <div className={`wdp-hero ${lc}`}>
            <div className="wdp-hero-chips">
              {word.part_of_speech && (
                <span className="wdp-chip wdp-chip-pos">{word.part_of_speech}</span>
              )}
              <span className="wdp-chip wdp-chip-level">
                {word.knowledge_level
                  ? `L${word.knowledge_level} — ${LEVEL_LABELS[word.knowledge_level]}`
                  : 'Unrated'}
              </span>
              <button
                type="button"
                className={`wdp-speak-btn${isSpeaking ? ' is-speaking' : ''}`}
                onClick={handleSpeak}
                disabled={!hasSpeechSynthesis}
                aria-label="Pronounce"
                title={isSpeaking ? 'Playing…' : 'Pronounce'}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h3l4-3v10l-4-3H3z"/>
                  {isSpeaking
                    ? <path d="M11 6.5a2.5 2.5 0 0 1 0 3"/>
                    : <path d="M12.2 5.2a4 4 0 0 1 0 5.6"/>}
                </svg>
              </button>
            </div>

            <h2 className="wdp-term">{word.term}</h2>
            <p className="wdp-translation">{getMainTranslation(word)}</p>
          </div>

          {/* ── Scrollable fields ── */}
          <div className="wdp-body">
            <WordPageView word={word} topics={topics} hideTranslation hidePOS />
          </div>
        </>
      )}
    </aside>
  )
}
