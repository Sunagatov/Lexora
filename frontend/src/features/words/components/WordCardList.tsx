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
  const [isSpeaking, setIsSpeaking] = useState(false)

  function speak(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(word.term)
    u.lang = 'en-GB'
    u.rate = 0.92
    u.onstart = () => setIsSpeaking(true)
    u.onend = () => setIsSpeaking(false)
    u.onerror = () => setIsSpeaking(false)
    window.speechSynthesis.speak(u)
  }

  const lc = levelClass(word.knowledge_level)

  return (
    <article className={`word-card ${lc}${openLevel ? ' word-card-dropdown-open' : ''}`}>
      <Link className="word-card-body-tap" to={routes.word(word.id)} state={{fromTopicSlug}}>
        <div className="word-card-grid">
          <div className="word-card-left">
            <span style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
              <span className="word-term" style={{display: 'inline', flex: 'none', marginBottom: 0}}>{word.term}</span>
              <button type="button"
                className={`wdp-speak-btn ripple-btn${isSpeaking ? ' is-speaking' : ''}`}
                style={{marginLeft: 0}}
                onClick={speak}
                aria-label={`Pronounce ${word.term}`}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h3l4-3v10l-4-3H3z"/>
                  {isSpeaking ? <path d="M11 6.5a2.5 2.5 0 0 1 0 3"/> : <path d="M12.2 5.2a4 4 0 0 1 0 5.6"/>}
                </svg>
              </button>
            </span>
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
