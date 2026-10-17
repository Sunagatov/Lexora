import type {WordKnowledgeLevel} from '@/features/words/types/wordTypes'
import {LEVELS, LEVEL_LABELS, levelClass} from '@/features/words/model/wordDomain'
import {useLayoutEffect, useRef} from 'react'
import {createPortal} from 'react-dom'

export function LevelDropdown({current, anchor, onSelect, onClose}: {
  current: WordKnowledgeLevel | null
  anchor: HTMLElement
  onSelect: (l: WordKnowledgeLevel) => void
  onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!menu) return
    function updatePosition() {
      if (!menu) return
      const rect = anchor.getBoundingClientRect()
      const height = menu.offsetHeight
      const top = window.innerHeight - rect.bottom >= height + 8 ? rect.bottom + 6 : rect.top - height - 6
      Object.assign(menu.style, {
        top: `${Math.max(8, Math.min(top, window.innerHeight - height - 8))}px`,
        left: `${Math.max(8, Math.min(rect.right - menu.offsetWidth, window.innerWidth - menu.offsetWidth - 8))}px`,
        visibility: 'visible',
      })
    }
    updatePosition()
    const initialOption = menu.querySelector<HTMLButtonElement>('.level-dropdown-option-active') ?? menu.querySelector('button')
    initialOption?.focus({preventScroll: true})
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      anchor.focus({preventScroll: true})
    }
  }, [anchor])

  return createPortal(
    <>
      <div
        className="level-dropdown-overlay"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onClose()
        }}
      />
      <div
        ref={menuRef}
        className="level-dropdown"
        role="group" aria-label="Knowledge level"
        onKeyDown={event => {
          if (event.key === 'Escape') { event.stopPropagation(); onClose() }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            event.stopPropagation()
            const buttons = Array.from(event.currentTarget.querySelectorAll('button'))
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
            buttons[(index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length]?.focus()
          }
        }}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
      >
        {LEVELS.map((l) => (
          <button key={l} type="button"
            className={`level-dropdown-option ${levelClass(l)} ${l === current ? 'level-dropdown-option-active' : ''}`}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onSelect(l)
            }}
          >
            <span>{LEVEL_LABELS[l]}</span>
            {l === current && (
              <svg className="level-dropdown-check" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <polyline points="2,6 5,9 10,3"/>
              </svg>
            )}
          </button>
        ))}
      </div>
    </>,
    document.body,
  )
}
