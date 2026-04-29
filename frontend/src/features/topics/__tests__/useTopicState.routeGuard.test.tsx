import {renderHook} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'
import {useNavigate, useParams} from 'react-router-dom'

import type {Topic} from '@/shared/types'
import {routes} from '@/app/routes'
import {useTopicState} from '@/features/topics/hooks/useTopicState'

vi.mock('react-router-dom')

function makeTopic(id: number, name: string): Topic {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    description: null,
    parent_topic_id: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

describe('useTopicState route guarding', () => {
  it('redirects home when topics are loaded and slug is missing from the active list', () => {
    const navigate = vi.fn()
    vi.mocked(useParams).mockReturnValue({topicSlug: 'missing-topic'} as never)
    vi.mocked(useNavigate).mockReturnValue(navigate as never)

    renderHook(() => useTopicState([], new Map(), new Map(), true))

    expect(navigate).toHaveBeenCalledWith(routes.home, {replace: true})
  })

  it('does not redirect before topics have finished loading', () => {
    const navigate = vi.fn()
    vi.mocked(useParams).mockReturnValue({topicSlug: 'missing-topic'} as never)
    vi.mocked(useNavigate).mockReturnValue(navigate as never)

    renderHook(() => useTopicState([makeTopic(1, 'Alpha')], new Map(), new Map(), false))

    expect(navigate).not.toHaveBeenCalled()
  })
})
