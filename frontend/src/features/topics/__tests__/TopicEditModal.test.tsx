import {fireEvent, render, screen} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

import type {Topic} from '@/features/topics/types/topicTypes'
import {TopicEditModal} from '@/features/topics/components/TopicEditModal'

function makeTopic(id: number, name: string, parent_topic_id: number | null = null): Topic {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    description: null,
    parent_topic_id,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

describe('TopicEditModal', () => {
  it('submits topic name, description, and parent', () => {
    const topic = makeTopic(2, 'Cleaning and Laundry', 1)
    const topics = [
      makeTopic(1, 'Home Chores DIY Repairs Appliances'),
      topic,
      makeTopic(3, 'Travel'),
    ]
    const onSave = vi.fn()
    const onCancel = vi.fn()

    render(
      <TopicEditModal
        topic={topic}
        topics={topics}
        saving={false}
        error={null}
        onSave={onSave}
        onCancel={onCancel}
      />,
    )

    fireEvent.change(screen.getByLabelText('Name'), {target: {value: 'Laundry'}})
    fireEvent.change(screen.getByLabelText('Description'), {target: {value: 'Housework'}})
    fireEvent.change(screen.getByLabelText('Parent topic'), {target: {value: ''}})
    fireEvent.click(screen.getByRole('button', {name: 'Save'}))

    expect(onSave).toHaveBeenCalledWith({
      name: 'Laundry',
      description: 'Housework',
      parent_topic_id: null,
    })
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('blocks close interactions while saving', () => {
    const topic = makeTopic(2, 'Cleaning and Laundry', 1)
    const topics = [makeTopic(1, 'Home Chores DIY Repairs Appliances'), topic]
    const onSave = vi.fn()
    const onCancel = vi.fn()

    const {container} = render(
      <TopicEditModal
        topic={topic}
        topics={topics}
        saving
        error={null}
        onSave={onSave}
        onCancel={onCancel}
      />,
    )

    fireEvent.click(container.firstElementChild as Element)
    fireEvent.keyDown(document, {key: 'Escape'})

    expect(onCancel).not.toHaveBeenCalled()
    expect((screen.getByRole('button', {name: 'Cancel'}) as HTMLButtonElement).disabled).toBe(true)
  })
})
