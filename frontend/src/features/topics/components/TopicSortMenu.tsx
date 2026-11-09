import {createPortal} from 'react-dom'
import {useLayoutEffect, useRef, type RefObject} from 'react'
import type {SortMode} from '@/features/topics/model/topicSort'

export function SortMenu({options, current, anchorRef, onSelect, onClose}: {
  options: {value: SortMode; label: string}[]
  current: SortMode
  anchorRef: RefObject<HTMLButtonElement | null>
  onSelect: (v: SortMode) => void
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useLayoutEffect(() => {
    const dialog = dialogRef.current
    const anchor = anchorRef.current
    if (!dialog || !anchor) return
    dialog.showModal()
    const position = () => {
      const rect = anchor.getBoundingClientRect()
      dialog.style.top = `${Math.max(8, Math.min(rect.bottom + 4, innerHeight - dialog.offsetHeight - 8))}px`
      dialog.style.left = `${Math.max(8, Math.min(rect.right - dialog.offsetWidth, innerWidth - dialog.offsetWidth - 8))}px`
    }
    position()
    const onResize = () => {if (!anchor.getBoundingClientRect().width) onClose(); else position()}
    dialog.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      dialog.close()
      if (anchor.isConnected) anchor.focus({preventScroll: true})
    }
  }, [anchorRef, onClose])

  return createPortal(
    <dialog ref={dialogRef} className="sidebar-sort-menu" aria-label="Sort topics"
      onCancel={event => {event.preventDefault(); event.stopPropagation(); onClose()}}
      onClick={event => {event.stopPropagation(); if (event.target === event.currentTarget) onClose()}}
      onKeyDown={event => {
        if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation(); onClose(); return}
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'))
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length
        buttons[next]?.focus()
      }}>
      <div role="menu" aria-label="Topic sort options">
        {options.map((o) => (
          <button key={o.value} type="button"
            role="menuitemradio" aria-checked={current === o.value}
            className={`sidebar-sort-option ${current === o.value ? 'active' : ''}`}
            onClick={() => onSelect(o.value)}
          >
            {o.label}
            {current === o.value && (
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <polyline points="2,6 5,9 10,3" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </dialog>,
    document.body,
  )
}
