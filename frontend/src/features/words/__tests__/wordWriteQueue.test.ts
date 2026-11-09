import {describe, expect, it, vi} from 'vitest'
import {enqueueWordWrite} from '../api/wordWriteQueue'

describe('word write ordering', () => {
  it('waits for an earlier rating before sending a newer editor save for the same word', async () => {
    let resolve!: (value: string) => void
    const first = enqueueWordWrite(9101, () => new Promise<string>(done => {resolve = done}))
    const edit = vi.fn().mockResolvedValue('Okay')
    const second = enqueueWordWrite(9101, edit)
    expect(edit).not.toHaveBeenCalled()
    expect(await enqueueWordWrite(9102, () => Promise.resolve('independent'))).toBe('independent')
    resolve('Strong')
    expect(await first).toBe('Strong')
    expect(await second).toBe('Okay')
    expect(edit).toHaveBeenCalledOnce()
  })

  it('allows the next edit after an earlier write fails and releases the queue', async () => {
    let reject!: (error: Error) => void
    const first = enqueueWordWrite(9103, () => new Promise((_resolve, fail) => {reject = fail}))
    const second = enqueueWordWrite(9103, () => Promise.resolve('Okay'))
    reject(new Error('failed rating'))
    await expect(first).rejects.toThrow('failed rating')
    expect(await second).toBe('Okay')
    expect(await enqueueWordWrite(9103, () => Promise.resolve('Strong'))).toBe('Strong')
  })
})
