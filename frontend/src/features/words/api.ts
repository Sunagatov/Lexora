import {buildApiUrl, buildRequestHeaders, request} from '../../shared/http'
import {ApiError} from '../../shared/apiError'
import type {Word, WordKnowledgeLevel, WorkbookImportResponse} from '../../shared/types'

export const fetchWords = (params: {topicId?: number; search?: string} = {}) => {
  const q = new URLSearchParams()
  if (params.topicId) q.set('topic_id', String(params.topicId))
  if (params.search?.trim()) q.set('search', params.search.trim())
  const qs = q.toString()
  return request<Word[]>(`/api/words${qs ? `?${qs}` : ''}`)
}

export const fetchWord                = (id: number)                                                    => request<Word>(`/api/words/${id}`)
export const updateWord               = (id: number, payload: Partial<Omit<Word, 'id' | 'created_at' | 'updated_at'>>) => request<Word>(`/api/words/${id}`, {method: 'PUT', body: JSON.stringify(payload)})
export const deleteWord               = (id: number)                                                    => request<void>(`/api/words/${id}`, {method: 'DELETE'})
export const updateWordKnowledgeLevel = (id: number, level: WordKnowledgeLevel, source = 'study_list') =>
  request<Word>(`/api/words/${id}`, {method: 'PUT', body: JSON.stringify({knowledge_level: level, progress_source: source})})
export const quickAddWord = (term: string, translation: string, topicIds: number[]) =>
  request<Word>(
    '/api/words',
    {method: 'POST', body: JSON.stringify({term, translations: translation, topic_ids: topicIds, knowledge_level: 1})},
  )
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
    throw new ApiError(response.status, detail)
  }

  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const match = disposition.match(/filename="([^"]+)"/)
  const filename = match?.[1] ?? 'lexora-vocabulary.xlsx'

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function importWordsWorkbook(file: File): Promise<WorkbookImportResponse> {
  const formData = new FormData()
  formData.append('file', file)

  return request<WorkbookImportResponse>('/api/words/import/xlsx', {
    method: 'POST',
    body: formData,
  })
}
