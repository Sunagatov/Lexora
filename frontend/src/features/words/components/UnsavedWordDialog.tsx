import {useId, useLayoutEffect, useRef} from 'react'
import {createPortal} from 'react-dom'

export function UnsavedWordDialog({onDiscard, onKeep}: {onDiscard: () => void; onKeep: () => void}) {
  const ref = useRef<HTMLDialogElement>(null)
  const title = useId()
  useLayoutEffect(() => {
    const active = document.activeElement as HTMLElement | null
    const dialog = ref.current
    dialog?.showModal()
    return () => {dialog?.close(); if (active?.isConnected) active.focus({preventScroll: true})}
  }, [])
  return createPortal(<dialog ref={ref} className="topic-edit-dialog" aria-labelledby={title}
    onCancel={event => {event.preventDefault(); onKeep()}}>
    <div className="modal">
      <h2 id={title}>Discard unsaved changes?</h2>
      <p>Your word edits have not been saved. Leave this page and discard them?</p>
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onKeep}>Keep editing</button>
        <button type="button" className="btn btn-danger" onClick={onDiscard}>Discard changes</button>
      </div>
    </div>
  </dialog>, document.body)
}
