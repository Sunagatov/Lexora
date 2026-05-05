import {useState} from 'react'
import {Link} from 'react-router-dom'
import type {Word, WordKnowledgeLevel} from '@/features/words/types/wordTypes'
import {routes} from '@/app/routes'
import {LEVEL_LABELS, levelClass} from '@/features/words/model/wordDomain'
import {LevelDropdown, openUpward} from '@/features/words/components/LevelDropdown'
import {lexicalChips} from '@/features/words/model/wordPresenter'

type Props = {
  words: Word[]
  pendingWordId: number | null
  fromTopicSlug?: string
  onUpdate: (wordId: number, level: WordKnowledgeLevel) => void
}

function WordCard({word, pendingWordId, fromTopicSlug, onUpdate}: {
  word: Word
  pendingWordId: number | null
  fromTopicSlug?: string
  onUpdate: (wordId: number, level: WordKnowledgeLevel) => void
}) {
  const [openLevel, setOpenLevel] = useState(false)
  const [flipUp, setFlipUp] = useState(false)

  const lc = levelClass(word.knowledge_level)

  return (
    <article className={`word-card ${lc}${openLevel ? ' word-card-dropdown-open' : ''}`}>
      <Link className="word-card-body-tap" to={routes.word(word.id)} state={{fromTopicSlug}}>
        <div className="word-card-grid">
          <div className="word-card-left">
            <span className="word-term">{word.term}</span>
            {word.translation_entries[0] && <span className="word-translation-focus">{word.translation_entries[0]}</span>}
          </div>
          <div className="word-card-right">
            {(() => { const chips = lexicalChips(word); const cefr = chips.find(c => c.type === 'cefr'); const pos = chips.find(c => c.type === 'pos'); return (cefr || pos) ? <div className="word-summary-badges">{cefr && <span className={`header-badge header-badge-cefr header-badge-cefr-${cefr.label.toLowerCase()}`}>{cefr.label}</span>}{pos && <span className="header-badge header-badge-pos">{pos.label}</span>}</div> : null })()}
            <div className="word-card-level-wrap">
              <button
                type="button"
                className={`level-badge level-badge-btn ${lc}`}
                disabled={pendingWordId === word.id}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (openLevel) { setOpenLevel(false); return }
                  setFlipUp(openUpward(e.currentTarget))
                  setOpenLevel(true)
                }}
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
                  onSelect={(level) => { onUpdate(word.id, level); setOpenLevel(false) }}
                  onClose={() => setOpenLevel(false)}
                />
              )}
            </div>
          </div>
        </div>
      </Link>
    </article>
  )
}

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
