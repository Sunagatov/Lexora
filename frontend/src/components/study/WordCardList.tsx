import type {Word, WordKnowledgeLevel} from '../../lib/api'
import {LEVEL_LABELS, levelClass} from '../../lib/words'
import {LevelSwitcher} from './LevelSwitcher'

type Props = {
  words: Word[]
  pendingWordId: number | null
  onUpdate: (wordId: number, level: WordKnowledgeLevel) => void
}

export function WordCardList({words, pendingWordId, onUpdate}: Props) {
  return (
    <div className="word-card-list">
      {words.map((word) => {
        const lc = levelClass(word.knowledge_level)
        return (
          <article key={word.id} className="word-card">
            <div className="word-card-header">
              <div>
                <strong className="word-term">{word.term}</strong>
                <div className="word-chips">
                  {word.part_of_speech && <span className="chip">{word.part_of_speech}</span>}
                  {word.countability    && <span className="chip">{word.countability}</span>}
                  {word.pattern         && <span className="chip">{word.pattern}</span>}
                </div>
              </div>
              <span className={`level-badge ${lc}`}>{LEVEL_LABELS[word.knowledge_level ?? 0] ?? 'Unset'}</span>
            </div>

            <div className="word-card-body">
              <div className="word-translation">{word.translations}</div>
              {(word.past_simple || word.past_participle) && (
                <div className="word-extra">
                  <strong>Irregular:</strong>{' '}
                  {[word.past_simple, word.past_participle].filter(Boolean).join(' · ')}
                </div>
              )}
              {word.example && <div className="word-extra"><strong>Example:</strong> {word.example}</div>}
              {word.notes   && <div className="word-extra"><strong>Notes:</strong> {word.notes}</div>}
            </div>

            <LevelSwitcher
              level={word.knowledge_level}
              wordId={word.id}
              isPending={pendingWordId === word.id}
              onUpdate={onUpdate}
              btnSize="md"
            />
          </article>
        )
      })}
    </div>
  )
}
