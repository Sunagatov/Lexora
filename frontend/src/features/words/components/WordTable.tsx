import {Fragment, useState} from 'react'
import {Link} from 'react-router-dom'
import type {Word, WordKnowledgeLevel} from '@/features/words/types/wordTypes'
import {routes} from '@/app/routes'
import {LEVEL_LABELS, LEVEL_TIPS, levelClass} from '@/features/words/model/wordDomain'
import {LevelDropdown, openUpward} from '@/features/words/components/LevelDropdown'
import {WordSummaryContent} from '@/features/words/components/WordSummaryContent'
import {smartPreview} from '@/features/words/model/wordPresenter'

type Props = {
  words: Word[]
  pendingWordId: number | null
  fromTopicSlug?: string
  onUpdate: (wordId: number, level: WordKnowledgeLevel) => void
  onWordSelect?: (id: number) => void
  selectedWordId?: number | null
}

export function WordTable({words, pendingWordId, fromTopicSlug, onUpdate, onWordSelect, selectedWordId}: Props) {
  const [openId,     setOpenId]     = useState<number | null>(null)
  const [flipUp,     setFlipUp]     = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [speakingId, setSpeakingId] = useState<number | null>(null)

  function speak(id: number, term: string) {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(term)
    u.lang = 'en-GB'
    u.rate = 0.92
    u.onstart = () => setSpeakingId(id)
    u.onend = () => setSpeakingId(null)
    u.onerror = () => setSpeakingId(null)
    window.speechSynthesis.speak(u)
  }

  return (
    <div className="word-table-wrap">
      <table className="word-table" aria-label="Topic words table">
        <tbody>
          {words.map((word, idx) => {
            const isLast     = idx === words.length - 1
            const lc         = levelClass(word.knowledge_level)
            const isOpen     = openId === word.id
            const isExpanded = expandedId === word.id

            const showExample = word.example_entries.length > 0
            const showNotes   = word.notes   && smartPreview(word)?.label !== 'Notes'
            const showPattern = word.pattern && smartPreview(word)?.label !== 'Pattern' && smartPreview(word)?.label !== 'Forms'
            const hasExpanded = showExample || showNotes || showPattern

            return (
              <Fragment key={word.id}>
                <tr
                  className={`word-row ${lc}${selectedWordId === word.id ? ' word-row-panel-active' : ''}${onWordSelect ? ' word-row-clickable' : ''}`}
                  onClick={onWordSelect ? () => onWordSelect(word.id) : undefined}
                >
                  <td className="word-cell-word">
                    <span style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                    {onWordSelect ? (
                      <span className="word-term word-term-link" style={{display: 'inline', flex: 'none'}}>
                        {word.term}
                      </span>
                    ) : (
                      <Link className="word-term word-term-link" to={routes.word(word.id)} state={{fromTopicSlug}} style={{display: 'inline', flex: 'none'}}>
                        {word.term}
                      </Link>
                    )}
                    <button type="button"
                      className={`wdp-speak-btn ripple-btn${speakingId === word.id ? ' is-speaking' : ''}`}
                      style={{marginLeft: 0}}
                      onClick={(e) => { e.stopPropagation(); speak(word.id, word.term) }}
                      aria-label={`Pronounce ${word.term}`}>
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h3l4-3v10l-4-3H3z"/>
                        {speakingId === word.id ? <path d="M11 6.5a2.5 2.5 0 0 1 0 3"/> : <path d="M12.2 5.2a4 4 0 0 1 0 5.6"/>}
                      </svg>
                    </button>
                    </span>
                  </td>
                  <td className="word-cell-details">
                    <WordSummaryContent word={word} />
                  </td>
                  <td className="word-cell-knowledge">
                    <div className="word-level-wrap">
                      <div className="level-badge-wrap">
                        <button type="button" className={`level-badge level-badge-btn ${lc}`}
                          disabled={pendingWordId === word.id}
                          onClick={(e) => { e.stopPropagation(); if (isOpen) { setOpenId(null); return } setFlipUp(openUpward(e.currentTarget)); setOpenId(word.id) }}
                        >
                          {LEVEL_LABELS[word.knowledge_level ?? 0] ?? 'Unset'}
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                            <polyline points="2,3.5 5,6.5 8,3.5" />
                          </svg>
                        </button>
                        <span className="level-badge-tip">{LEVEL_TIPS[word.knowledge_level ?? 0]}</span>
                      </div>
                      {isOpen && (
                        <LevelDropdown current={word.knowledge_level as WordKnowledgeLevel | null} flipUp={flipUp}
                          onSelect={(l) => { onUpdate(word.id, l); setOpenId(null) }}
                          onClose={() => setOpenId(null)} />
                      )}
                      {hasExpanded && (
                        <button
                          type="button"
                          className="word-table-expand-btn"
                          onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : word.id) }}
                          aria-expanded={isExpanded}
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
                            style={{transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s'}}>
                            <polyline points="2,3.5 5,6.5 8,3.5" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {hasExpanded && (
                  <tr className={`word-row-detail ${lc}`}>
                    <td colSpan={3} style={{
                      padding: 0,
                      borderBottom: isExpanded && !isLast ? '1px solid var(--border)' : 'none',
                    }}>
                      <div className={`word-row-expand-body${isExpanded ? ' is-open' : ''}`}>
                        <div className="word-row-expand-content">
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
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
