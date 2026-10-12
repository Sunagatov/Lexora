import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {fetchWords} from '@/features/words/api/wordsApi'

describe('complete topic word loading', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })
  afterEach(() => { vi.unstubAllGlobals() })

  function page(words: {id: number}[], number: number, totalPages: number) {
    return new Response(JSON.stringify({words, page: number, total_pages: totalPages}), {
      headers: {'Content-Type': 'application/json'},
    })
  }

  it('loads later pages and preserves the topic and search filters', async () => {
    const first = Array.from({length: 100}, (_, i) => ({id: i + 1}))
    vi.mocked(fetch).mockResolvedValueOnce(page(first, 1, 2))
      .mockResolvedValueOnce(page([{id: 101}], 2, 2))

    const words = await fetchWords({topicId: 42, search: ' run '})

    expect(words).toEqual([...first, {id: 101}])
    const secondUrl = new URL(String(vi.mocked(fetch).mock.calls[1][0]))
    expect(secondUrl.searchParams.get('topic_id')).toBe('42')
    expect(secondUrl.searchParams.get('search')).toBe('run')
    expect(secondUrl.searchParams.get('page')).toBe('2')
    expect(secondUrl.searchParams.get('page_size')).toBe('100')
  })

  it('uses one request for an empty topic', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(page([], 1, 0))
    expect(await fetchWords()).toEqual([])
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('reports an error instead of silently showing a partial topic', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(page([{id: 1}], 1, 2))
      .mockResolvedValueOnce(new Response(JSON.stringify({detail: 'Failed'}), {status: 500}))
    await expect(fetchWords()).rejects.toMatchObject({status: 500})
  })
})
