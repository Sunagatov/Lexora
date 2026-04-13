import type {WordKnowledgeLevel} from '../../shared/types'
import {LEVELS, LEVEL_LABELS, levelClass} from '../../shared/wordDomain'

export function LevelDropdown({current, flipUp, onSelect, onClose}: {
  current: WordKnowledgeLevel | null
  flipUp: boolean
  onSelect: (l: WordKnowledgeLevel) => void
  onClose: () => void
}) {
  return (
    <>
      <div className="level-dropdown-overlay" onClick={onClose} />
      <div className={`level-dropdown ${flipUp ? 'level-dropdown-up' : 'level-dropdown-down'}`}>
        {LEVELS.map((l) => (
          <button key={l} type="button"
            className={`level-dropdown-option ${levelClass(l)} ${l === current ? 'level-dropdown-option-active' : ''}`}
            onClick={() => onSelect(l)}
          >
            <span className="level-dropdown-num">{l}</span>
            <span>{LEVEL_LABELS[l]}</span>
            {l === current && (
              <svg className="level-dropdown-check" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <polyline points="2,6 5,9 10,3"/>
              </svg>
            )}
          </button>
        ))}
      </div>
    </>
  )
}

export function openUpward(buttonEl: HTMLElement): boolean {
  return window.innerHeight - buttonEl.getBoundingClientRect().bottom < 220
}
