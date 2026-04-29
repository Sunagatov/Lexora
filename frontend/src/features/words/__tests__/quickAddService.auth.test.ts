import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {ApiError} from '../../../shared/apiError'
import {ensureInbox, suggestTopic} from '../quickAddService'
import * as topicsApi from '../../topics/api'

vi.mock('../../topics/api', () => ({
  createTopic: vi.fn(),
}))

vi.mock('../../auth/redirectIfUnauthorized', () => ({
  redirectIfUnauthorized: vi.fn(),
}))

vi.mock('../../../shared/http', () => ({
  request: vi.fn(),
}))

import {request} from '../../../shared/http'
import {redirectIfUnauthorized} from '../../auth/redirectIfUnauthorized'

describe('quickAddService auth handling', () => {
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

    await expect(ensureInbox([], vi.fn())).resolves.toBeNull()
    expect(redirectIfUnauthorized).toHaveBeenCalledWith(expect.objectContaining({status: 401}))
  })
})
