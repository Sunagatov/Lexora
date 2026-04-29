import {createPortal} from 'react-dom'
import type {RefObject} from 'react'
import type {SortMode} from '@/features/topics/model/topicSort'

export function SortMenu({options, current, anchorRef, onSelect, onClose}: {
  options: {value: SortMode; label: string}[]
  current: SortMode
  anchorRef: RefObject<HTMLButtonElement | null>
  onSelect: (v: SortMode) => void
  onClose: () => void
}) {
  const rect = anchorRef.current?.getBoundingClientRect()
  const menuHeight = options.length * 36 + 8
  const spaceBelow = rect ? window.innerHeight - rect.bottom : 999
  const style = rect
    ? spaceBelow >= menuHeight
      ? {top: rect.bottom + 4, right: window.innerWidth - rect.right}
      : {bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right}
    : {top: 0, right: 0}

  return createPortal(
    <>
      <div className="sidebar-sort-overlay" onClick={onClose} />
      <div className="sidebar-sort-menu" style={{...style, position: 'fixed'}}>
        {options.map((o) => (
          <button key={o.value} type="button"
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
    </>,
    document.body,
  )
}
