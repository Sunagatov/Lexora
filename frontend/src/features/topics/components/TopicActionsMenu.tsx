import {useEffect, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import type {Topic} from '@/features/topics/types/topicTypes'
import type {TopicButtonActionProps} from '@/features/topics/components/TopicButton'

type Props = Omit<TopicButtonActionProps, 'onSelect'> & {topic: Topic; isPinned: boolean}

export function TopicActionsMenu({topic, isPinned, onPin, onEdit, onDelete}: Props) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    if (!dialog) return
    const trigger = triggerRef.current
    dialog.showModal()
    return () => {
      dialog.close()
      trigger?.focus({preventScroll: true})
    }
  }, [open])

  function select(action: (id: number) => void) {
    setOpen(false)
    action(topic.id)
  }

  return <>
    <button ref={triggerRef} type="button" className="topic-actions-trigger"
      aria-label={`Actions for ${topic.name}`} aria-haspopup="dialog" aria-expanded={open}
      onClick={() => setOpen(true)}>
      <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
        <circle cx="9" cy="4" r="1.5" /><circle cx="9" cy="9" r="1.5" /><circle cx="9" cy="14" r="1.5" />
      </svg>
    </button>
    {open && createPortal(
      <dialog ref={dialogRef} className="topic-actions-sheet" aria-label={`Actions for ${topic.name}`}
        onCancel={event => {event.preventDefault(); setOpen(false)}}
        onKeyDown={event => {if (event.key === 'Escape') event.stopPropagation()}}
        onClick={event => {if (event.target === event.currentTarget) setOpen(false)}}>
        <div>
          <h2>{topic.name}</h2>
          <button type="button" onClick={() => select(onPin)}>{isPinned ? 'Unpin topic' : 'Pin topic'}</button>
          <button type="button" onClick={() => select(onEdit)}>Edit topic</button>
          <button type="button" className="topic-actions-danger" onClick={() => select(onDelete)}>Delete topic</button>
          <button type="button" className="topic-actions-cancel" onClick={() => setOpen(false)}>Cancel</button>
        </div>
      </dialog>, document.body,
    )}
  </>
}
