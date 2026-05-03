import {buildApiUrl, buildRequestHeaders, request} from '@/shared/api/http'
import {ApiError} from '@/shared/api/apiError'
import type {Word, WordKnowledgeLevel, WorkbookImportResponse, EnrichResult} from '@/features/words/types/wordTypes'
import {redirectIfUnauthorized} from '@/features/auth/lib/redirectIfUnauthorized'
import {DEFAULT_WORD_PROGRESS_SOURCE} from '@/features/words/model/wordDomain'

export const fetchWords = async (params: {topicId?: number; search?: string} = {}) => {
  const q = new URLSearchParams()
  if (params.topicId) q.set('topic_id', String(params.topicId))
  if (params.search?.trim()) q.set('search', params.search.trim())
  q.set('page_size', '100')
  const qs = q.toString()
  const res = await request<{words: Word[]}>(`/api/words${qs ? `?${qs}` : ''}`)
  return res.words
}

export const fetchWord                = (id: number)                                                    => request<Word>(`/api/words/${id}`)
export const updateWord               = (id: number, payload: Partial<Omit<Word, 'id' | 'created_at' | 'updated_at'>>) => request<Word>(`/api/words/${id}`, {method: 'PUT', body: JSON.stringify(payload)})
export const deleteWord               = (id: number)                                                    => request<void>(`/api/words/${id}`, {method: 'DELETE'})
export const updateWordKnowledgeLevel = (id: number, level: WordKnowledgeLevel, source = DEFAULT_WORD_PROGRESS_SOURCE) =>
  request<Word>(`/api/words/${id}`, {method: 'PUT', body: JSON.stringify({knowledge_level: level, progress_source: source})})
export const quickAddWord = (payload: {term: string; topic_ids: number[]; translation_entries: string[]; knowledge_level: number; [key: string]: unknown}) =>
  request<Word>('/api/words', {method: 'POST', body: JSON.stringify(payload)})
export const enrichWord = (term: string) =>
  request<EnrichResult>('/api/words/enrich', {method: 'POST', body: JSON.stringify({term})})
export const restoreWord              = (id: number)                                                    => request<Word>(`/api/trash/words/${id}/restore`, {method: 'POST'})
export const fetchTrashWords          = ()                                                              => request<(Word & {deleted_at: string})[]>('/api/trash/words')

function parseErrorDetail(body: unknown, fallback: string): string {
  if (
    body &&
    typeof body === 'object' &&
    'detail' in body &&
    typeof (body as {detail?: unknown}).detail === 'string'
  ) {
    return (body as {detail: string}).detail
  }
  return fallback
}

export async function exportWordsWorkbook(): Promise<void> {
  const response = await fetch(buildApiUrl('/api/words/export/xlsx'), {
    method: 'GET',
    credentials: 'include',
    headers: buildRequestHeaders(),
  })

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`
    try {
      detail = parseErrorDetail(await response.json(), detail)
    } catch {
      // ignore parse errors
    }
    const error = new ApiError(response.status, detail)
    redirectIfUnauthorized(error)
    throw error
  }

  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const filenameStarMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  const filenameMatch = disposition.match(/filename="([^"]+)"/i)
  const filename = filenameStarMatch?.[1]
    ? decodeURIComponent(filenameStarMatch[1])
    : filenameMatch?.[1] ?? 'lexora-vocabulary.xlsx'

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export type WordListParams = {
  search?: string; topicId?: number; pos?: string; cefr?: string;
  level?: number; completeness?: string; page?: number; pageSize?: number;
}

export type WordListResponse = {
  words: Word[]; total: number; page: number; page_size: number; total_pages: number;
}

export const fetchWordList = (params: WordListParams = {}): Promise<WordListResponse> => {
  const q = new URLSearchParams()
  if (params.search?.trim()) q.set('search', params.search.trim())
  if (params.topicId) q.set('topic_id', String(params.topicId))
  if (params.pos) q.set('pos', params.pos)
  if (params.cefr) q.set('cefr', params.cefr)
  if (params.level) q.set('level', String(params.level))
  if (params.completeness) q.set('completeness', params.completeness)
  if (params.page) q.set('page', String(params.page))
  if (params.pageSize) q.set('page_size', String(params.pageSize))
  const qs = q.toString()
  return request<WordListResponse>(`/api/words${qs ? `?${qs}` : ''}`)
}

export const batchUpdateWords = (payload: {
  word_ids: number[];
  knowledge_level?: number;
  add_topic_ids?: number[];
  remove_topic_ids?: number[];
}) => request<{updated: number}>('/api/words/batch', {method: 'PATCH', body: JSON.stringify(payload)})

export function importWordsWorkbook(file: File): Promise<WorkbookImportResponse> {
  const formData = new FormData()
  formData.append('file', file)

  return request<WorkbookImportResponse>('/api/words/import/xlsx', {
    method: 'POST',
    body: formData,
  })
}
