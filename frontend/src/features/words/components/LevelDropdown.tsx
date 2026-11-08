import type {WordKnowledgeLevel} from '@/features/words/types/wordTypes'
import {LEVELS, LEVEL_LABELS, levelClass} from '@/features/words/model/wordDomain'
import {useLayoutEffect, useRef} from 'react'
import {createPortal} from 'react-dom'
import {useIsMobile} from '@/shared/hooks/useIsMobile'

const DESCRIPTIONS: Record<WordKnowledgeLevel, string> = {
  1: 'Needs practice', 3: 'Partially known', 4: 'Confident', 5: 'Set aside',
}

export function LevelDropdown({current, anchor, term, onSelect, onClose}: {
  current: WordKnowledgeLevel | null
  anchor: HTMLElement
  term?: string
  onSelect: (level: WordKnowledgeLevel) => void
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const isMobile = useIsMobile()

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    function position() {
      if (!dialog) return
      if (isMobile) { dialog.style.removeProperty('top'); dialog.style.removeProperty('left'); return }
      const rect = anchor.getBoundingClientRect()
      const height = dialog.offsetHeight
      const top = window.innerHeight - rect.bottom >= height + 8 ? rect.bottom + 6 : rect.top - height - 6
      dialog.style.top = `${Math.max(8, Math.min(top, window.innerHeight - height - 8))}px`
      dialog.style.left = `${Math.max(8, Math.min(rect.right - dialog.offsetWidth, window.innerWidth - dialog.offsetWidth - 8))}px`
    }
    position()
    dialog.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({preventScroll: true})
    window.addEventListener('resize', position)
    return () => {
      window.removeEventListener('resize', position)
      dialog.close()
      if (anchor.isConnected) anchor.focus({preventScroll: true})
    }
  }, [anchor, isMobile])

  return createPortal(
    <dialog ref={dialogRef} className="knowledge-picker" aria-label="Knowledge level"
      onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() } }}
      onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose() }}
      onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) onClose() }}>
      <div className="knowledge-picker-content">
        <div className="knowledge-picker-heading">
          <div><h2>Knowledge level</h2>{term && <p>{term}</p>}</div>
          <button type="button" className="knowledge-picker-close" aria-label="Close knowledge selector" onClick={onClose}>×</button>
        </div>
        <div role="group" aria-label="Knowledge level" className="knowledge-picker-options"
          onKeyDown={event => {
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
            event.preventDefault()
            const buttons = Array.from(event.currentTarget.querySelectorAll('button'))
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
            buttons[(index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length]?.focus()
          }}>
          {LEVELS.map(level => <button key={level} type="button" aria-label={LEVEL_LABELS[level]} aria-pressed={level === current}
            className={`knowledge-picker-option ${levelClass(level)}`}
            onClick={() => onSelect(level)}>
            <span className="knowledge-picker-dot" aria-hidden="true" />
            <span className="knowledge-picker-copy"><strong>{LEVEL_LABELS[level]}</strong><small>{DESCRIPTIONS[level]}</small></span>
            <span className="knowledge-picker-check" aria-hidden="true">{level === current ? '✓' : ''}</span>
          </button>)}
        </div>
      </div>
    </dialog>, document.body,
  )
}
