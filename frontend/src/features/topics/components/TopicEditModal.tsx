import {useEffect, useMemo, useState} from 'react'
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
  const parentOptions = useMemo(() => buildParentOptions(topics, topic), [topic, topics])
  const [name, setName] = useState(topic.name)
  const [description, setDescription] = useState(topic.description ?? '')
  const [parentTopicId, setParentTopicId] = useState<number | ''>(topic.parent_topic_id ?? '')

  useEffect(() => {
    setName(topic.name)
    setDescription(topic.description ?? '')
    setParentTopicId(topic.parent_topic_id ?? '')
  }, [topic])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel, saving])

  const canSave = name.trim().length > 0 && !saving

  return (
    <div className="modal-overlay" onClick={() => { if (!saving) onCancel() }}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Edit topic</h2>
        <div className="wp-field">
          <label className="wp-label" htmlFor="topic-name">Name</label>
          <input
            id="topic-name"
            className="wp-input"
            value={name}
            maxLength={200}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="wp-field">
          <label className="wp-label" htmlFor="topic-parent">Parent topic</label>
          <select
            id="topic-parent"
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
          <label className="wp-label" htmlFor="topic-description">Description</label>
          <textarea
            id="topic-description"
            className="wp-input wp-textarea"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        {error && <p className="login-error" style={{textAlign: 'left'}}>{error}</p>}
        <div className="modal-actions">
          <button type="button" className="modal-btn-cancel" onClick={onCancel} disabled={saving}>Cancel</button>
          <button
            type="button"
            className="modal-btn-confirm"
            disabled={!canSave}
            onClick={() => onSave({
              name: name.trim(),
              description: description.trim() ? description.trim() : null,
              parent_topic_id: parentTopicId === '' ? null : parentTopicId,
            })}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
