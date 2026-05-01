import {renderHook} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'
import {useNavigate, useParams} from 'react-router-dom'

import type {Topic} from '@/features/topics/types/topicTypes'
import {useTopicState} from '@/features/topics/hooks/useTopicState'

vi.mock('react-router-dom')

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

describe('useTopicState subtree totals', () => {
  it('returns the provided topic counts and progress', () => {
    const navigate = vi.fn()
    vi.mocked(useParams).mockReturnValue({topicSlug: 'parent'} as never)
    vi.mocked(useNavigate).mockReturnValue(navigate as never)

    const topics = [
      makeTopic(1, 'Parent'),
      makeTopic(2, 'Child One', 1),
      makeTopic(3, 'Child Two', 1),
    ]
    const topicCounts = new Map([[1, 2], [2, 1], [3, 1]])
    const topicProgress = new Map([[1, 67], [2, 100], [3, 33]])

    const {result} = renderHook(() => useTopicState(topics, topicCounts, topicProgress))

    expect(result.current.selectedTopicId).toBe(1)
    expect(result.current.topicCounts.get(1)).toBe(2)
    expect(result.current.topicCounts.get(2)).toBe(1)
    expect(result.current.topicCounts.get(3)).toBe(1)
    expect(result.current.topicProgress.get(1)).toBe(67)
    expect(result.current.topicProgress.get(2)).toBe(100)
    expect(result.current.topicProgress.get(3)).toBe(33)
    expect(navigate).not.toHaveBeenCalled()
  })
})
