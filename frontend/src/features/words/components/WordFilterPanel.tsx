import {useEffect, useRef, type ReactNode} from 'react'
import {createPortal} from 'react-dom'
import {useIsMobile} from '@/shared/hooks/useIsMobile'

type Props = {children: ReactNode; onClose: () => void}

export function WordFilterPanel({children, onClose}: Props) {
  const isMobile = useIsMobile()
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (!isMobile) return
    const dialog = dialogRef.current
    if (!dialog) return
    const active = document.activeElement as HTMLElement | null
    const scrollAreas = Array.from(document.querySelectorAll<HTMLElement>('.word-collection-scroll, .all-words-page'))
      .map(element => ({element, overflow: element.style.overflow}))
    for (const {element} of scrollAreas) element.style.overflow = 'hidden'
    dialog.showModal()
    return () => {
      dialog.close()
      for (const {element, overflow} of scrollAreas) element.style.overflow = overflow
      active?.focus({preventScroll: true})
    }
  }, [isMobile])

  const panel = <div className="toolbar-filter-panel">{children}</div>
  if (!isMobile) return panel
  return createPortal(
    <dialog ref={dialogRef} className="toolbar-filter-sheet" aria-label="Filters & sorting"
      onCancel={event => { event.preventDefault(); onClose() }}
      onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      {panel}
    </dialog>,
    document.body,
  )
}
