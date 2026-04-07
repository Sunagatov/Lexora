import {useEffect, useRef, useState} from 'react'

export type DropdownOption<T extends string> = {
  value: T
  label: string
}

type Props<T extends string> = {
  value: T
  options: DropdownOption<T>[]
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
}

export function CompactDropdown<T extends string>({value, options, onChange, ariaLabel, className = ''}: Props<T>) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const selected = options.find((o) => o.value === value) ?? options[0]

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  return (
    <div ref={rootRef} className={`dropdown ${open ? 'dropdown-open' : ''} ${className}`.trim()}>
      <button
        type="button"
        className="dropdown-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="dropdown-trigger-label">{selected.label}</span>
        <span className="dropdown-trigger-icon" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="dropdown-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              className={`dropdown-option ${o.value === value ? 'dropdown-option-active' : ''}`}
              onClick={() => { onChange(o.value); setOpen(false) }}
            >
              <span className="dropdown-option-label">{o.label}</span>
              {o.value === value && <span className="dropdown-check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
