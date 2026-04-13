import {useState} from 'react'
import {useNavigate} from 'react-router-dom'
import type {Word, WordKnowledgeLevel} from '../../shared/http'
import {LEVEL_LABELS, levelClass} from '../../shared/wordDomain'
import {LevelDropdown, openUpward} from './LevelDropdown'
import {routes} from '../../shared/routes'
import {WordSummaryContent} from './WordSummaryContent'

type Props = {
  words: Word[]
  pendingWordId: number | null
  fromTopicSlug?: string
  onUpdate: (wordId: number, level: WordKnowledgeLevel) => void
}

export function WordTable({words, pendingWordId, fromTopicSlug, onUpdate}: Props) {
  const [openId, setOpenId] = useState<number | null>(null)
  const [flipUp, setFlipUp] = useState(false)
  const navigate = useNavigate()

  return (
    <div className="word-table-wrap">
      <table className="word-table" aria-label="Topic words table">
        <tbody>
          {words.map((word) => {
            const lc     = levelClass(word.knowledge_level)
            const isOpen = openId === word.id
            return (
              <tr key={word.id} className={`word-row ${lc}`}>
                <td className="word-cell-word">
                  <strong className="word-term word-term-link" onClick={() => navigate(routes.word(word.id), {state: {fromTopicSlug}})}>
                    {word.term}
                  </strong>
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
