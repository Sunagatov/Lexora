import {useState} from 'react'
import {useNavigate} from 'react-router-dom'
import type {Word, WordKnowledgeLevel} from '../../shared/http'
import {LEVEL_LABELS, levelClass} from '../../shared/wordDomain'
import {LevelDropdown, openUpward} from './LevelDropdown'
import {lexicalChips, smartPreview} from './wordPresenter'
import {routes} from '../../shared/routes'

type Props = {
  words: Word[]
  pendingWordId: number | null
  fromTopicSlug?: string
  onUpdate: (wordId: number, level: WordKnowledgeLevel) => void
}

function WordCard({word, pendingWordId, fromTopicSlug, onUpdate}: {
  word: Word; pendingWordId: number | null; fromTopicSlug?: string
  onUpdate: (wordId: number, level: WordKnowledgeLevel) => void
}) {
  const [openLevel, setOpenLevel] = useState(false)
  const [flipUp,    setFlipUp]    = useState(false)
  const [expanded,  setExpanded]  = useState(false)
  const navigate = useNavigate()

  const lc      = levelClass(word.knowledge_level)
  const chips   = lexicalChips(word)
  const preview = smartPreview(word)
  const showExample = word.example
  const showNotes   = word.notes   && preview?.label !== 'Notes'
  const showPattern = word.pattern && preview?.label !== 'Pattern' && preview?.label !== 'Forms'
  const hasExpanded = showExample || showNotes || showPattern

  return (
    <article className={`word-card ${lc}`}>
      <div className="word-card-header">
        <strong className="word-term word-term-link" onClick={() => navigate(routes.word(word.id), {state: {fromTopicSlug}})}>
          {word.term}
        </strong>
        <div className="word-card-level-wrap">
          <button type="button" className={`level-badge level-badge-btn ${lc}`}
            disabled={pendingWordId === word.id}
            onClick={(e) => { e.stopPropagation(); if (openLevel) { setOpenLevel(false); return } setFlipUp(openUpward(e.currentTarget)); setOpenLevel(true) }}
          >
            {LEVEL_LABELS[word.knowledge_level ?? 0] ?? 'Unset'}
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <polyline points="2,3.5 5,6.5 8,3.5" />
            </svg>
          </button>
          {openLevel && (
            <LevelDropdown current={word.knowledge_level as WordKnowledgeLevel | null} flipUp={flipUp}
              onSelect={(l) => { onUpdate(word.id, l); setOpenLevel(false) }}
              onClose={() => setOpenLevel(false)} />
          )}
        </div>
      </div>

      <div className="word-card-body-tap" role="button" tabIndex={0}
        onClick={() => navigate(routes.word(word.id), {state: {fromTopicSlug}})}
        onKeyDown={(e) => e.key === 'Enter' && navigate(routes.word(word.id), {state: {fromTopicSlug}})}
      >
        {chips.length > 0 && (
          <div className="word-chips">{chips.map((c) => <span key={c} className="chip">{c}</span>)}</div>
        )}
        <div className="word-translation">{word.translations}</div>
        {preview && (
          <div className="word-preview-line">
            <span className="word-preview-label">{preview.label}:</span>
            <span className="word-preview-text">{preview.text}</span>
          </div>
        )}
      </div>

      {hasExpanded && (
        <>
          {expanded && (
            <div className="word-card-extras">
              {showExample && <div className="word-extra"><strong>Example:</strong> {word.example}</div>}
              {showNotes   && <div className="word-extra"><strong>Notes:</strong> {word.notes}</div>}
              {showPattern && <div className="word-extra"><strong>Pattern:</strong> {word.pattern}</div>}
            </div>
          )}
          <button type="button" className="word-card-expand-btn" onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Less' : 'More'}
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
              style={{transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s'}}>
              <polyline points="2,3.5 5,6.5 8,3.5" />
            </svg>
          </button>
        </>
      )}
    </article>
  )
}

export function WordCardList({words, pendingWordId, fromTopicSlug, onUpdate}: Props) {
  return (
    <div className="word-card-list">
      {words.map((word) => (
        <WordCard key={word.id} word={word} pendingWordId={pendingWordId} fromTopicSlug={fromTopicSlug} onUpdate={onUpdate} />
      ))}
    </div>
  )
}
