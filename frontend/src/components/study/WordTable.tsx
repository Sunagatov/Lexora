import type {Word, WordKnowledgeLevel} from '../../lib/api'
import {LEVEL_LABELS, levelClass} from '../../lib/words'
import {LevelSwitcher} from './LevelSwitcher'

type Props = {
  words: Word[]
  pendingWordId: number | null
  onUpdate: (wordId: number, level: WordKnowledgeLevel) => void
}

export function WordTable({words, pendingWordId, onUpdate}: Props) {
  return (
    <div className="card" style={{padding: 0, overflow: 'hidden'}}>
      <div className="word-table-wrap">
        <table className="word-table">
          <thead>
            <tr>
              <th>Word</th>
              <th>Translation / details</th>
              <th>Knowledge</th>
            </tr>
          </thead>
          <tbody>
            {words.map((word) => {
              const lc = levelClass(word.knowledge_level)
              return (
                <tr key={word.id} className={`word-row ${lc}`}>
                  <td className="word-cell-word">
                    <strong className="word-term">{word.term}</strong>
                    <div className="word-chips">
                      {word.part_of_speech && <span className="chip">{word.part_of_speech}</span>}
                      {word.countability    && <span className="chip">{word.countability}</span>}
                      {word.pattern         && <span className="chip">{word.pattern}</span>}
                    </div>
                  </td>

                  <td className="word-cell-details">
                    <div className="word-translation">{word.translations}</div>
                    {(word.past_simple || word.past_participle) && (
                      <div className="word-extra">
                        <strong>Irregular:</strong>{' '}
                        {[word.past_simple, word.past_participle].filter(Boolean).join(' · ')}
                      </div>
                    )}
                    {word.example && <div className="word-extra"><strong>Example:</strong> {word.example}</div>}
                    {word.notes   && <div className="word-extra"><strong>Notes:</strong> {word.notes}</div>}
                  </td>

                  <td className="word-cell-knowledge">
                    <span className={`level-badge ${lc}`}>{LEVEL_LABELS[word.knowledge_level ?? 0] ?? 'Unset'}</span>
                    <LevelSwitcher
                      level={word.knowledge_level}
                      wordId={word.id}
                      isPending={pendingWordId === word.id}
                      onUpdate={onUpdate}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
