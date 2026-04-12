import {useState} from 'react'
import {useNavigate} from 'react-router-dom'
import type {Word, WordKnowledgeLevel} from '../../shared/http'
import {LEVELS, LEVEL_LABELS, levelClass} from '../../shared/wordDomain'

type Props = {
  words: Word[]
  pendingWordId: number | null
  fromTopicSlug: string | undefined
  onUpdate: (wordId: number, level: WordKnowledgeLevel) => void
}

const DROPDOWN_HEIGHT = 220

function openUpward(buttonEl: HTMLElement): boolean {
  const rect = buttonEl.getBoundingClientRect()
  return window.innerHeight - rect.bottom < DROPDOWN_HEIGHT
}

export function WordCardList({words, pendingWordId, fromTopicSlug, onUpdate}: Props) {
  const [openId, setOpenId] = useState<number | null>(null)
  const [flipUp, setFlipUp] = useState(false)
  const navigate = useNavigate()

  function handleToggle(e: React.MouseEvent<HTMLButtonElement>, wordId: number, isOpen: boolean) {
    if (isOpen) { setOpenId(null); return }
    setFlipUp(openUpward(e.currentTarget))
    setOpenId(wordId)
  }

  return (
    <div className="word-card-list">
      {words.map((word) => {
        const lc     = levelClass(word.knowledge_level)
        const isOpen = openId === word.id
        return (
          <article key={word.id} className={`word-card ${lc}`}>
            <div className="word-card-header">
              <strong className="word-term word-term-link" onClick={() => navigate(`/words/${word.id}`, {state: {fromTopicSlug}})}>{word.term}</strong>
              <div className="word-card-level-wrap">
                <button
                  type="button"
                  className={`level-badge level-badge-btn ${lc}`}
                  disabled={pendingWordId === word.id}
                  onClick={(e) => handleToggle(e, word.id, isOpen)}
                >
                  {LEVEL_LABELS[word.knowledge_level ?? 0] ?? 'Unset'}
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <polyline points="2,3.5 5,6.5 8,3.5" />
                  </svg>
                </button>
                {isOpen && (
                  <LevelDropdown
                    current={word.knowledge_level as WordKnowledgeLevel | null}
                    flipUp={flipUp}
                    onSelect={(l) => { onUpdate(word.id, l); setOpenId(null) }}
                    onClose={() => setOpenId(null)}
                  />
                )}
              </div>
            </div>
            <div className="word-translation">{word.translations}</div>
            {(word.past_simple || word.past_participle || word.example || word.notes) && (
              <div className="word-card-extras">
                {(word.past_simple || word.past_participle) && (
                  <div className="word-extra"><strong>Irregular:</strong> {[word.past_simple, word.past_participle].filter(Boolean).join(' · ')}</div>
                )}
                {word.example && <div className="word-extra"><strong>Example:</strong> {word.example}</div>}
                {word.notes   && <div className="word-extra"><strong>Notes:</strong> {word.notes}</div>}
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}

function LevelDropdown({current, flipUp, onSelect, onClose}: {current: WordKnowledgeLevel | null; flipUp: boolean; onSelect: (l: WordKnowledgeLevel) => void; onClose: () => void}) {
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
