import {useState} from 'react'
import {useNavigate} from 'react-router-dom'
import type {Word, WordKnowledgeLevel} from '../../shared/http'
import {LEVELS, LEVEL_LABELS, levelClass} from '../../shared/wordDomain'

type Props = {
  words: Word[]
  pendingWordId: number | null
  fromTopicSlug?: string
  onUpdate: (wordId: number, level: WordKnowledgeLevel) => void
}

const DROPDOWN_HEIGHT = 220

function openUpward(buttonEl: HTMLElement): boolean {
  const rect = buttonEl.getBoundingClientRect()
  return window.innerHeight - rect.bottom < DROPDOWN_HEIGHT
}

// ── Lexical chips ─────────────────────────────────────────────────────────────

function lexicalChips(word: Word): string[] {
  const chips: string[] = []
  if (word.part_of_speech) chips.push(word.part_of_speech)
  if (word.past_simple || word.past_participle) chips.push('irregular')
  if (word.countability) chips.push(word.countability.toLowerCase())
  return chips
}

// ── Smart preview line ────────────────────────────────────────────────────────

function smartPreview(word: Word): {label: string; text: string} | null {
  const pos = word.part_of_speech?.toLowerCase()
  // Irregular verb forms first
  if (word.past_simple || word.past_participle) {
    const forms = [word.term, word.past_simple, word.past_participle].filter(Boolean).join(' · ')
    return {label: 'Forms', text: forms}
  }
  // Pattern for verbs
  if (pos === 'verb' && word.pattern) return {label: 'Pattern', text: word.pattern}
  // Notes for phrases/prepositions
  if ((pos === 'phrase' || pos === 'preposition') && word.notes) return {label: 'Notes', text: word.notes}
  // Pattern for any word
  if (word.pattern) return {label: 'Pattern', text: word.pattern}
  // Notes fallback
  if (word.notes) return {label: 'Notes', text: word.notes}
  return null
}

// ── LevelDropdown ─────────────────────────────────────────────────────────────

function LevelDropdown({current, flipUp, onSelect, onClose}: {
  current: WordKnowledgeLevel | null
  flipUp: boolean
  onSelect: (l: WordKnowledgeLevel) => void
  onClose: () => void
}) {
  return (
    <>
      <div className="level-dropdown-overlay" onClick={onClose} />
      <div className={`level-dropdown ${flipUp ? 'level-dropdown-up' : 'level-dropdown-down'}`}>
        {LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            className={`level-dropdown-option ${levelClass(l)} ${l === current ? 'level-dropdown-option-active' : ''}`}
            onClick={() => onSelect(l)}
          >
            <span className="level-dropdown-num">{l}</span>
            <span>{LEVEL_LABELS[l]}</span>
            {l === current && <svg className="level-dropdown-check" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="2,6 5,9 10,3"/></svg>}
          </button>
        ))}
      </div>
    </>
  )
}

// ── WordCard ──────────────────────────────────────────────────────────────────

function WordCard({word, pendingWordId, fromTopicSlug, onUpdate}: {
  word: Word
  pendingWordId: number | null
  fromTopicSlug?: string
  onUpdate: (wordId: number, level: WordKnowledgeLevel) => void
}) {
  const [openLevel, setOpenLevel] = useState(false)
  const [flipUp,    setFlipUp]    = useState(false)
  const [expanded,  setExpanded]  = useState(false)
  const navigate = useNavigate()

  const lc      = levelClass(word.knowledge_level)
  const chips   = lexicalChips(word)
  const preview = smartPreview(word)

  // What to show in expanded area (exclude what's already in preview)
  const showExample  = word.example
  const showNotes    = word.notes && preview?.label !== 'Notes'
  const showPattern  = word.pattern && preview?.label !== 'Pattern' && preview?.label !== 'Forms'
  const hasExpanded  = showExample || showNotes || showPattern

  function handleLevelToggle(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    if (openLevel) { setOpenLevel(false); return }
    setFlipUp(openUpward(e.currentTarget))
    setOpenLevel(true)
  }

  return (
    <article className={`word-card ${lc}`}>
      {/* Header: term + level badge */}
      <div className="word-card-header">
        <strong
          className="word-term word-term-link"
          onClick={() => navigate(`/words/${word.id}`, {state: {fromTopicSlug}})}
        >
          {word.term}
        </strong>
        <div className="word-card-level-wrap">
          <button
            type="button"
            className={`level-badge level-badge-btn ${lc}`}
            disabled={pendingWordId === word.id}
            onClick={handleLevelToggle}
          >
            {LEVEL_LABELS[word.knowledge_level ?? 0] ?? 'Unset'}
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <polyline points="2,3.5 5,6.5 8,3.5" />
            </svg>
          </button>
          {openLevel && (
            <LevelDropdown
              current={word.knowledge_level as WordKnowledgeLevel | null}
              flipUp={flipUp}
              onSelect={(l) => { onUpdate(word.id, l); setOpenLevel(false) }}
              onClose={() => setOpenLevel(false)}
            />
          )}
        </div>
      </div>

      {/* Clickable body: chips + translation + preview → opens word page */}
      <div
        className="word-card-body-tap"
        onClick={() => navigate(`/words/${word.id}`, {state: {fromTopicSlug}})}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && navigate(`/words/${word.id}`, {state: {fromTopicSlug}})}
      >
        {/* Lexical chips */}
        {chips.length > 0 && (
          <div className="word-chips">
            {chips.map((c) => <span key={c} className="chip">{c}</span>)}
          </div>
        )}

        {/* Translation */}
        <div className="word-translation">{word.translations}</div>

        {/* Smart preview line */}
        {preview && (
          <div className="word-preview-line">
            <span className="word-preview-label">{preview.label}:</span>
            <span className="word-preview-text">{preview.text}</span>
          </div>
        )}
      </div>

      {/* Expandable extras */}
      {hasExpanded && (
        <>
          {expanded && (
            <div className="word-card-extras">
              {showExample && (
                <div className="word-extra"><strong>Example:</strong> {word.example}</div>
              )}
              {showNotes && (
                <div className="word-extra"><strong>Notes:</strong> {word.notes}</div>
              )}
              {showPattern && (
                <div className="word-extra"><strong>Pattern:</strong> {word.pattern}</div>
              )}
            </div>
          )}
          <button
            type="button"
            className="word-card-expand-btn"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Less' : 'More'}
            <svg
              width="10" height="10" viewBox="0 0 10 10" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
              style={{transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s'}}
            >
              <polyline points="2,3.5 5,6.5 8,3.5" />
            </svg>
          </button>
        </>
      )}
    </article>
  )
}

// ── WordCardList ──────────────────────────────────────────────────────────────

export function WordCardList({words, pendingWordId, fromTopicSlug, onUpdate}: Props) {
  return (
    <div className="word-card-list">
      {words.map((word) => (
        <WordCard
          key={word.id}
          word={word}
          pendingWordId={pendingWordId}
          fromTopicSlug={fromTopicSlug}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  )
}
