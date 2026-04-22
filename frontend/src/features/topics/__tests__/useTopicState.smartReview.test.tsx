import {renderHook} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'
import {useNavigate, useParams} from 'react-router-dom'
import {useTopicState} from '../useTopicState'
import type {Topic} from '../../../shared/types'

vi.mock('react-router-dom')

describe('useTopicState smart review navigation', () => {
  it('navigates to a topic without inheriting search params', () => {
    const navigate = vi.fn()
    vi.mocked(useNavigate).mockReturnValue(navigate)
    vi.mocked(useParams).mockReturnValue({topicSlug: 'demo'} as never)

    const topics = [
      {id: 1, name: 'Demo', slug: 'demo'},
    ] as Topic[]

    const {result} = renderHook(() => useTopicState(topics))

    result.current.selectTopic(1)

    expect(navigate).toHaveBeenCalledWith({pathname: '/topics/demo', search: ''})
  })

  it('navigates to smart review without inheriting topic search params', () => {
    const navigate = vi.fn()
    vi.mocked(useNavigate).mockReturnValue(navigate)
    vi.mocked(useParams).mockReturnValue({topicSlug: 'demo'} as never)

    const topics = [
      {id: 1, name: 'Demo', slug: 'demo'},
    ] as Topic[]

    const {result} = renderHook(() => useTopicState(topics))

    result.current.selectSmartReview()

    expect(navigate).toHaveBeenCalledWith({pathname: '/smart-review', search: ''})
  })
})
