import type {WordKnowledgeLevel} from '../../lib/api'
import {LEVELS, LEVEL_LABELS, levelClass} from '../../lib/words'

type Props = {
  level: number | null
  wordId: number
  isPending: boolean
  onUpdate: (wordId: number, level: WordKnowledgeLevel) => void
  btnSize?: 'sm' | 'md'
}

export function LevelSwitcher({level, wordId, isPending, onUpdate, btnSize = 'sm'}: Props) {
  return (
    <div className={`level-switcher ${btnSize === 'md' ? 'level-switcher-md' : ''}`}>
      {LEVELS.map((l) => (
        <button
          key={l}
          type="button"
          className={`level-btn ${l === level ? `level-btn-active ${levelClass(l)}` : ''}`}
          disabled={isPending}
          onClick={() => onUpdate(wordId, l)}
          title={LEVEL_LABELS[l]}
        >
          {l}
        </button>
      ))}
    </div>
  )
}
