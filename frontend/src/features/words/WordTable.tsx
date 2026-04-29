import {Fragment, useState} from 'react'
import {Link} from 'react-router-dom'
import type {Word, WordKnowledgeLevel} from '../../shared/types'
import {routes} from '../../app/routes'
import {LEVEL_LABELS, levelClass} from './wordDomain'
import {LevelDropdown, openUpward} from './LevelDropdown'
import {WordSummaryContent} from './WordSummaryContent'
import {smartPreview} from './wordPresenter'

type Props = {
  words: Word[]
  pendingWordId: number | null
  fromTopicSlug?: string
  onUpdate: (wordId: number, level: WordKnowledgeLevel) => void
}

export function WordTable({words, pendingWordId, fromTopicSlug, onUpdate}: Props) {
  const [openId,     setOpenId]     = useState<number | null>(null)
  const [flipUp,     setFlipUp]     = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  return (
    <div className="word-table-wrap">
      <table className="word-table" aria-label="Topic words table">
        <tbody>
          {words.map((word) => {
            const lc         = levelClass(word.knowledge_level)
            const isOpen     = openId === word.id
            const isExpanded = expandedId === word.id

            const showExample = word.example
            const showNotes   = word.notes   && smartPreview(word)?.label !== 'Notes'
            const showPattern = word.pattern && smartPreview(word)?.label !== 'Pattern' && smartPreview(word)?.label !== 'Forms'
            const hasExpanded = showExample || showNotes || showPattern

            return (
              <Fragment key={word.id}>
                <tr className={`word-row ${lc}`}>
                  <td className="word-cell-word">
                    <Link className="word-term word-term-link" to={routes.word(word.id)} state={{fromTopicSlug}}>
                      {word.term}
                    </Link>
                  </td>
                  <td className="word-cell-details">
                    <WordSummaryContent word={word} />
                  </td>
                  <td className="word-cell-knowledge">
                    <div className="word-level-wrap">
                      <button type="button" className={`level-badge level-badge-btn ${lc}`}
                        disabled={pendingWordId === word.id}
                        onClick={(e) => { if (isOpen) { setOpenId(null); return } setFlipUp(openUpward(e.currentTarget)); setOpenId(word.id) }}
                      >
                        {LEVEL_LABELS[word.knowledge_level ?? 0] ?? 'Unset'}
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                          <polyline points="2,3.5 5,6.5 8,3.5" />
                        </svg>
                      </button>
                      {isOpen && (
                        <LevelDropdown current={word.knowledge_level as WordKnowledgeLevel | null} flipUp={flipUp}
                          onSelect={(l) => { onUpdate(word.id, l); setOpenId(null) }}
                          onClose={() => setOpenId(null)} />
                      )}
                      {hasExpanded && (
                        <button
                          type="button"
                          className="word-table-expand-btn"
                          onClick={() => setExpandedId(isExpanded ? null : word.id)}
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
                {isExpanded && (
                  <tr className={`word-row-detail ${lc}`}>
                    <td colSpan={3} className="word-cell-detail">
                      {showExample && (
                        <div className="word-extra">
                          <strong>Example:</strong>
                          {word.example_entries && word.example_entries.length > 1 ? (
                            <ol className="word-extra-examples">
                              {word.example_entries.map((e, i) => <li key={i}>{e}</li>)}
                            </ol>
                          ) : (
                            <span> {word.example_entries?.[0] ?? word.example}</span>
                          )}
                        </div>
                      )}
                      {showNotes   && <div className="word-extra"><strong>Notes:</strong> {word.notes}</div>}
                      {showPattern && <div className="word-extra"><strong>Pattern:</strong> {word.pattern}</div>}
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
