import {useState} from 'react'
import {Link} from 'react-router-dom'
import type {Word, WordKnowledgeLevel} from '@/features/words/types/wordTypes'
import {routes} from '@/app/routes'
import {LEVEL_LABELS, levelClass} from '@/features/words/model/wordDomain'
import {LevelDropdown, openUpward} from '@/features/words/components/LevelDropdown'
import {WordSummaryContent} from '@/features/words/components/WordSummaryContent'
import {smartPreview} from '@/features/words/model/wordPresenter'

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

  const lc      = levelClass(word.knowledge_level)
  const showExample = word.example_entries.length > 0
  const showNotes   = word.notes   && smartPreview(word)?.label !== 'Notes'
  const showPattern = word.pattern && smartPreview(word)?.label !== 'Pattern' && smartPreview(word)?.label !== 'Forms'
  const hasExpanded = showExample || showNotes || showPattern

  return (
    <article className={`word-card ${lc}`}>
      <div className="word-card-header">
        <Link className="word-term word-term-link" to={routes.word(word.id)} state={{fromTopicSlug}}>
          {word.term}
        </Link>
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

      <Link
        className="word-card-body-tap"
        to={routes.word(word.id)}
        state={{fromTopicSlug}}
      >
        <WordSummaryContent word={word} />
      </Link>

      {hasExpanded && (
        <>
          {expanded && (
            <div className="word-card-extras">
              {showExample && (
                <div className="word-extra">
                  <strong>Example:</strong>
                  {word.example_entries.length > 1 ? (
                    <ol className="word-extra-examples">
                      {word.example_entries.map((e, i) => <li key={i}>{e}</li>)}
                    </ol>
                  ) : (
                    <span> {word.example_entries[0]}</span>
                  )}
                </div>
              )}
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
