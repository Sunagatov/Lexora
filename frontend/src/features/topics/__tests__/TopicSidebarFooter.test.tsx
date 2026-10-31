import {fireEvent, render, screen} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

import type {Topic} from '@/features/topics/types/topicTypes'
import {TopicSidebarFooter} from '@/features/topics/components/TopicSidebarFooter'

function makeTopic(id: number, name: string): Topic {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    description: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

describe('TopicSidebarFooter', () => {
  it('does not create a topic from Enter while pending', () => {
    const onCreate = vi.fn()

    render(
      <TopicSidebarFooter
        addingTopic
        topicError={null}
        newTopicName="Astronomy"
        newTopicParentId=""
        topicOptions={[makeTopic(1, 'Inbox')]}
        createPending
        onNewTopicNameChange={vi.fn()}
        onNewTopicParentIdChange={vi.fn()}
        onCreate={onCreate}
        onCancel={vi.fn()}
        onStartAdd={vi.fn()}
      />,
    )

    fireEvent.keyDown(screen.getByPlaceholderText('Topic name…'), {key: 'Enter'})

    expect(onCreate).not.toHaveBeenCalled()
  })
})
