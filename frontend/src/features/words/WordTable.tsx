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

function lexicalChips(word: Word): string[] {
  const chips: string[] = []
  if (word.part_of_speech) chips.push(word.part_of_speech)
  if (word.past_simple || word.past_participle) chips.push('irregular')
  if (word.countability) chips.push(word.countability.toLowerCase())
  return chips
}

function smartPreview(word: Word): {label: string; text: string} | null {
  const pos = word.part_of_speech?.toLowerCase()
  if (word.past_simple || word.past_participle) {
    const forms = [word.term, word.past_simple, word.past_participle].filter(Boolean).join(' · ')
    return {label: 'Forms', text: forms}
  }
  if (pos === 'verb' && word.pattern) return {label: 'Pattern', text: word.pattern}
  if ((pos === 'phrase' || pos === 'preposition') && word.notes) return {label: 'Notes', text: word.notes}
  if (word.pattern) return {label: 'Pattern', text: word.pattern}
  if (word.example) return {label: 'Example', text: word.example}
  if (word.notes) return {label: 'Notes', text: word.notes}
  return null
}

export function WordTable({words, pendingWordId, fromTopicSlug, onUpdate}: Props) {
  const [openId, setOpenId] = useState<number | null>(null)
  const [flipUp, setFlipUp] = useState(false)
  const navigate = useNavigate()

  function handleToggle(e: React.MouseEvent<HTMLButtonElement>, wordId: number, isOpen: boolean) {
    if (isOpen) { setOpenId(null); return }
    setFlipUp(openUpward(e.currentTarget))
    setOpenId(wordId)
  }

  return (
    <div className="word-table-wrap">
      <table className="word-table" aria-label="Topic words table">
        <tbody>
          {words.map((word) => {
            const lc      = levelClass(word.knowledge_level)
            const isOpen  = openId === word.id
            const chips   = lexicalChips(word)
            const preview = smartPreview(word)
            return (
              <tr key={word.id} className={`word-row ${lc}`}>
                <td className="word-cell-word">
                  <strong
                    className="word-term word-term-link"
                    onClick={() => navigate(`/words/${word.id}`, {state: {fromTopicSlug}})}
                  >
                    {word.term}
                  </strong>
                  {chips.length > 0 && (
                    <div className="word-chips">
                      {chips.map((c) => <span key={c} className="chip">{c}</span>)}
                    </div>
                  )}
                </td>
                <td className="word-cell-details">
                  <div className="word-translation">{word.translations}</div>
                  {preview && (
                    <div className="word-preview-line">
                      <span className="word-preview-label">{preview.label}:</span>
                      <span className="word-preview-text">{preview.text}</span>
                    </div>
                  )}
                </td>
                <td className="word-cell-knowledge">
                  <div className="word-level-wrap">
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
                      <>
                        <div className="level-dropdown-overlay" onClick={() => setOpenId(null)} />
                        <div className={`level-dropdown ${flipUp ? 'level-dropdown-up' : 'level-dropdown-down'}`}>
                          {LEVELS.map((l) => (
                            <button
                              key={l}
                              type="button"
                              className={`level-dropdown-option ${levelClass(l)} ${l === word.knowledge_level ? 'level-dropdown-option-active' : ''}`}
                              onClick={() => { onUpdate(word.id, l); setOpenId(null) }}
                            >
                              <span className="level-dropdown-num">{l}</span>
                              <span>{LEVEL_LABELS[l]}</span>
                              {l === word.knowledge_level && (
                                <svg className="level-dropdown-check" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                                  <polyline points="2,6 5,9 10,3" />
                                </svg>
                              )}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
