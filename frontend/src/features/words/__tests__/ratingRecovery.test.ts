import {beforeEach, expect, it, vi} from 'vitest'
import {updateWord, updateWordKnowledgeLevel} from '../api/wordsApi'
import {request} from '@/shared/api/http'
import {ApiError} from '@/shared/api/apiError'

vi.mock('@/shared/api/http', () => ({request: vi.fn(), buildRequestHeaders: () => new Headers({'X-Lexora-Language': 'en'})}))
beforeEach(() => vi.mocked(request).mockReset())

it.each([new TypeError('connection dropped'), new ApiError(504, 'gateway timeout')])('confirms a saved rating after an uncertain response without repeating the write: %s', async error => {
  vi.mocked(request).mockRejectedValueOnce(error).mockResolvedValueOnce({id: 1, knowledge_level: 4})
  await expect(updateWordKnowledgeLevel(1, 4, 'smart_review')).resolves.toMatchObject({knowledge_level: 4})
  expect(request).toHaveBeenCalledTimes(2)
  expect(vi.mocked(request).mock.calls.map(([, init]) => init?.method ?? 'GET')).toEqual(['PUT', 'GET'])
  expect(vi.mocked(request).mock.calls[1][1]?.headers).toBe(vi.mocked(request).mock.calls[0][1]?.headers)
})

it('keeps a genuinely unsaved rating as an error', async () => {
  const error = new TypeError('connection dropped')
  vi.mocked(request).mockRejectedValueOnce(error).mockResolvedValueOnce({id: 1, knowledge_level: 1})
  await expect(updateWordKnowledgeLevel(1, 4)).rejects.toBe(error)
})

it.each([401, 403, 404, 409, 422])('does not reinterpret a rejected rating (%s) as a saved change', async status => {
  const error = new ApiError(status, 'Rejected')
  vi.mocked(request).mockRejectedValueOnce(error)
  await expect(updateWordKnowledgeLevel(1, 4)).rejects.toBe(error)
  expect(request).toHaveBeenCalledOnce()
})

it('does not infer that a content edit succeeded from a matching level', async () => {
  const error = new TypeError('connection dropped')
  vi.mocked(request).mockRejectedValueOnce(error)
  await expect(updateWord(1, {term: 'new term', knowledge_level: 4})).rejects.toBe(error)
  expect(request).toHaveBeenCalledOnce()
})

it('holds the word write queue until verification finishes', async () => {
  let resolve!: (value: unknown) => void
  vi.mocked(request).mockRejectedValueOnce(new TypeError('lost response'))
    .mockImplementationOnce(() => new Promise(done => {resolve = done}))
    .mockResolvedValueOnce({id: 1, knowledge_level: 3})
  const rating = updateWordKnowledgeLevel(1, 4)
  await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2))
  const edit = updateWord(1, {knowledge_level: 3})
  expect(request).toHaveBeenCalledTimes(2)
  resolve({id: 1, knowledge_level: 4})
  await rating
  await edit
  expect(request).toHaveBeenCalledTimes(3)
})
