import {useEffect, useId, useMemo, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import {Button} from '@/shared/components/Button'
import type {Topic} from '@/features/topics/types/topicTypes'
import {isPosGroup} from '@/features/topics/model/topicSidebarModel'

type Props = {
  topic: Topic
  topics: Topic[]
  onSave: (payload: {name: string; description: string | null; parent_topic_id: number | null}) => void
  onCancel: () => void
  saving: boolean
  error: string | null
}

function buildParentOptions(topics: Topic[], topic: Topic): Topic[] {
  const childrenByParent = new Map<number | null, number[]>()
  for (const item of topics) {
    const parentId = item.parent_topic_id ?? null
    const list = childrenByParent.get(parentId) ?? []
    list.push(item.id)
    childrenByParent.set(parentId, list)
  }

  const descendants = new Set<number>()
  const stack = [...(childrenByParent.get(topic.id) ?? [])]
  while (stack.length > 0) {
    const current = stack.pop()
    if (current == null || descendants.has(current)) continue
    descendants.add(current)
    stack.push(...(childrenByParent.get(current) ?? []))
  }

  const parentOptions = topics.filter((item) => item.id !== topic.id && !descendants.has(item.id) && !isPosGroup(item))
  const currentParent = topic.parent_topic_id == null ? null : topics.find((item) => item.id === topic.parent_topic_id) ?? null
  if (currentParent && !parentOptions.some((item) => item.id === currentParent.id)) parentOptions.unshift(currentParent)
  return parentOptions
}

export function TopicEditModal({topic, topics, onSave, onCancel, saving, error}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const nameId = useId()
  const parentId = useId()
  const descriptionId = useId()
  const parentOptions = useMemo(() => buildParentOptions(topics, topic), [topic, topics])
  const [name, setName] = useState(topic.name)
  const [description, setDescription] = useState(topic.description ?? '')
  const [parentTopicId, setParentTopicId] = useState<number | ''>(topic.parent_topic_id ?? '')

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const active = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      // Focus the row first so its actions are visible when focus returns.
      active?.closest('.topic-item')?.querySelector<HTMLElement>('.topic-item-select')?.focus({preventScroll: true})
      active?.focus({preventScroll: true})
    }
  }, [])

  const canSave = name.trim().length > 0 && !saving

  return createPortal(
    <dialog ref={dialogRef} className="topic-edit-dialog" aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); if (!saving) onCancel() }}
      onClick={event => { if (event.target === event.currentTarget && !saving) onCancel() }}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title" id={titleId}>Edit topic</h2>
        <div className="topic-edit-fields">
          <fieldset disabled={saving}>
            <div className="wp-field">
              <label className="wp-label" htmlFor={nameId}>Name</label>
              <input
                id={nameId}
                className="wp-input"
                value={name}
                maxLength={200}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="wp-field">
              <label className="wp-label" htmlFor={parentId}>Parent topic</label>
              <select
                id={parentId}
                className="wp-input"
                value={parentTopicId === '' ? '' : String(parentTopicId)}
                onChange={(e) => setParentTopicId(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">Top-level topic</option>
                {parentOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="wp-field">
              <label className="wp-label" htmlFor={descriptionId}>Description</label>
              <textarea
                id={descriptionId}
                className="wp-input wp-textarea"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </fieldset>
        </div>
        {error && <p role="alert" className="login-error" style={{textAlign: 'left'}}>{error}</p>}
        <div className="modal-actions">
          <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button
            type="button"
            size="sm"
            disabled={!canSave}
            onClick={() => onSave({
              name: name.trim(),
              description: description.trim() ? description.trim() : null,
              parent_topic_id: parentTopicId === '' ? null : parentTopicId,
            })}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </dialog>,
    document.body,
  )
}
