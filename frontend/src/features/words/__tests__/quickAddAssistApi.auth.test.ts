import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {ApiError} from '@/shared/api/apiError'
import {ensureInboxTopic, suggestTopic, findTopicByName} from '@/features/words/api/quickAddAssistApi'
import * as topicsApi from '@/features/topics/api/topicsApi'

vi.mock('@/features/topics/api/topicsApi', () => ({
  createTopic: vi.fn(),
}))

vi.mock('@/features/auth/lib/redirectIfUnauthorized', () => ({
  redirectIfUnauthorized: vi.fn(),
}))

vi.mock('@/shared/api/http', () => ({
  request: vi.fn(),
}))

import {request} from '@/shared/api/http'
import {redirectIfUnauthorized} from '@/features/auth/lib/redirectIfUnauthorized'

describe('quickAddAssistApi auth handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('redirects unauthorized suggest-topic failures and returns null', async () => {
    vi.mocked(request).mockRejectedValue(new ApiError(403, 'Invalid CSRF token'))

    await expect(suggestTopic('run', 'бежать')).resolves.toBeNull()
    expect(redirectIfUnauthorized).toHaveBeenCalledWith(expect.objectContaining({status: 403}))
  })

  it('redirects unauthorized inbox creation failures and returns null', async () => {
    vi.mocked(topicsApi.createTopic).mockRejectedValue(new ApiError(401, 'Not authenticated'))

    await expect(ensureInboxTopic([], vi.fn())).resolves.toBeNull()
    expect(redirectIfUnauthorized).toHaveBeenCalledWith(expect.objectContaining({status: 401}))
  })

  it('reuses an existing inbox topic regardless of casing', async () => {
    const onCreated = vi.fn()

    await expect(
      ensureInboxTopic([{id: 7, name: 'inbox', slug: 'inbox', description: null, is_active: true, created_at: '', updated_at: ''}], onCreated),
    ).resolves.toBe(7)

    expect(topicsApi.createTopic).not.toHaveBeenCalled()
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('finds topics by name regardless of casing', () => {
    const topics = [
      {id: 3, name: 'Phrasal Verbs', slug: 'phrasal-verbs', description: null, is_active: true, created_at: '', updated_at: ''},
    ]

    expect(findTopicByName(topics, 'phrasal verbs')?.id).toBe(3)
  })
})
