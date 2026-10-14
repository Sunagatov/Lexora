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

    render(
      <TopicEditModal
        topic={topic}
        topics={topics}
        saving
        error={null}
        onSave={onSave}
        onCancel={onCancel}
      />,
    )

    const dialog = screen.getByRole('dialog', {name: 'Edit topic'})
    fireEvent.click(dialog)
    fireEvent(dialog, new Event('cancel', {cancelable: true}))

    expect(onCancel).not.toHaveBeenCalled()
    expect((screen.getByRole('button', {name: 'Cancel'}) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByLabelText('Name').matches(':disabled')).toBe(true)
    expect(screen.getByLabelText('Description').matches(':disabled')).toBe(true)
  })

  it('preserves an edited draft when topics refetch and keeps it outside the sidebar', () => {
    const topic = makeTopic(1, 'Travel')
    const props = {topic, topics: [topic], saving: false, error: null, onSave: vi.fn(), onCancel: vi.fn()}
    const {container, rerender} = render(<TopicEditModal {...props} />)
    const dialog = screen.getByRole('dialog', {name: 'Edit topic'})
    expect(container.contains(dialog)).toBe(false)
    fireEvent.change(screen.getByLabelText('Name'), {target: {value: 'My travel words'}})
    rerender(<TopicEditModal {...props} topic={{...topic}} />)
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('My travel words')
    fireEvent.click(screen.getByRole('button', {name: 'Save'}))
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({name: 'My travel words'}))
  })

  it('restores scrolling and focus when dismissed', () => {
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()
    const topic = makeTopic(1, 'Travel')
    const onCancel = vi.fn()
    const {unmount} = render(<TopicEditModal topic={topic} topics={[topic]} saving={false} error="Could not save topic" onSave={vi.fn()} onCancel={onCancel} />)
    expect(screen.getByRole('alert').textContent).toBe('Could not save topic')
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent(screen.getByRole('dialog'), new Event('cancel', {cancelable: true}))
    expect(onCancel).toHaveBeenCalledOnce()
    unmount()
    expect(document.body.style.overflow).toBe('')
    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })
})
