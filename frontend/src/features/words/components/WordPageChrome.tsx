import {LEVEL_LABELS, levelClass} from '@/features/words/model/wordDomain'
import type {Word} from '@/features/words/types/wordTypes'

type HeroProps = {
  word: Word
  topicName?: string
  editing: boolean
  isSpeaking: boolean
  onBack: () => void
  onEdit: () => void
  onSpeak: () => void
  hasSpeechSynthesis: boolean
}

type FooterNavProps = {
  currentIndex: number
  totalWords: number
  hasPrev: boolean
  hasNext: boolean
  onPrev: () => void
  onNext: () => void
}

function getHeroTranslation(word: Word): string {
  if (word.translation_entries?.length) {
    return word.translation_entries.join(' · ')
  }
  return word.translations?.trim() ?? ''
}

export function WordPageSkeleton() {
  const rows = [75, 55, 90, 60, 40]
  return (
    <div className="word-page">
      <div className="word-page-hero-wrap">
        <div className="word-page-topbar">
          <div className="sk" style={{width: 48, height: 14}} />
          <div className="sk" style={{width: 38, height: 14}} />
        </div>
        <div className="sk" style={{height: 130, borderRadius: 'var(--radius-lg)'}} />
      </div>
      <div className="word-page-inner">
        <div className="sk-rows">
          {rows.map((width, index) => (
            <div
              key={index}
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 1fr',
                gap: 12,
                padding: '14px 20px',
                borderBottom: index < rows.length - 1 ? '1px solid var(--border)' : 'none',
                alignItems: 'center',
              }}
            >
              <div className="sk" style={{height: 11, width: 70}} />
              <div className="sk" style={{height: 14, width: `${width}%`}} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function WordPageHero({
  word,
  topicName,
  editing,
  isSpeaking,
  onBack,
  onEdit,
  onSpeak,
  hasSpeechSynthesis,
}: HeroProps) {
  const heroLevelClass = levelClass(word.knowledge_level)
  const translation = getHeroTranslation(word)

  return (
    <div className="word-page-hero-wrap">
      <div className="word-page-topbar">
        <button type="button" className="word-page-back-btn" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="9,2 4,7 9,12" />
          </svg>
          Back
        </button>
        {!editing && (
          <button type="button" className="word-page-edit-btn" onClick={onEdit}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z" />
              <path d="M7.5 2.5l2 2" />
            </svg>
            Edit
          </button>
        )}
      </div>

      <div className={`word-page-hero ${heroLevelClass}`}>
        <div className="word-page-hero-meta">
          <div className="word-page-hero-chips">
            {word.part_of_speech && (
              <span className="word-page-pos-chip">{word.part_of_speech}</span>
            )}
            <span className="word-page-level-chip">
              {word.knowledge_level
                ? `Level ${word.knowledge_level} — ${LEVEL_LABELS[word.knowledge_level]}`
                : 'Unrated word'}
            </span>
            {topicName && <span className="word-page-topic-chip">{topicName}</span>}
          </div>
          <button
            type="button"
            className="word-page-pronounce-btn"
            onClick={onSpeak}
            disabled={!hasSpeechSynthesis}
            aria-label={`Play pronunciation for ${word.term}`}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h3l4-3v10l-4-3H3z" />
              <path d="M12.2 5.2a4 4 0 0 1 0 5.6" />
            </svg>
            {isSpeaking ? 'Playing…' : 'Pronounce'}
          </button>
        </div>

        <h1 className="word-page-term">{word.term}</h1>

        {translation && (
          <p className="word-page-hero-translation">{translation}</p>
        )}
      </div>
    </div>
  )
}

export function WordPageFooterNav({
  currentIndex,
  totalWords,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
}: FooterNavProps) {
  return (
    <div className="word-page-footer">
      <button type="button" className="word-page-nav-btn" disabled={!hasPrev} onClick={onPrev}>
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="9,2 4,7 9,12" />
        </svg>
        Prev
      </button>
      <span className="word-page-nav-pos">{currentIndex >= 0 ? `${currentIndex + 1} / ${totalWords}` : ''}</span>
      <button type="button" className="word-page-nav-btn word-page-nav-btn-next" disabled={!hasNext} onClick={onNext}>
        Next
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="5,2 10,7 5,12" />
        </svg>
      </button>
    </div>
  )
}
