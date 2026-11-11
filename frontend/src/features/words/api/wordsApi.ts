import {buildApiUrl, buildRequestHeaders, request} from '@/shared/api/http'
import {ApiError, isUncertainWriteError} from '@/shared/api/apiError'
import type {Word, WordKnowledgeLevel, WorkbookPreview, WorkbookImportResult, EnrichResult} from '@/features/words/types/wordTypes'
import {redirectIfUnauthorized} from '@/features/auth/lib/redirectIfUnauthorized'
import {DEFAULT_WORD_PROGRESS_SOURCE, type SortOption} from '@/features/words/model/wordDomain'
import {languagePreferences} from '@/features/languages/api'
import {enqueueWordWrite} from './wordWriteQueue'

function translationPayload<T extends object>(payload: T) {
  return ['translation_entries', 'definition', 'notes'].some(key => key in payload) ? {...payload, translation_language: languagePreferences().translationLanguage} : payload
}

export const fetchWords = async (params: {topicId?: number; search?: string} = {}) => {
  const q = new URLSearchParams()
  if (params.topicId) q.set('topic_id', String(params.topicId))
  if (params.search?.trim()) q.set('search', params.search.trim())
  q.set('page_size', '100')
  const qs = q.toString()
  const res = await request<WordListResponse>(`/api/words?${qs}`)
  const words = [...res.words]
  for (let page = 2; page <= res.total_pages; page++) {
    q.set('page', String(page))
    const next = await request<WordListResponse>(`/api/words?${q.toString()}`)
    words.push(...next.words)
  }
  return words
}

export const fetchWord                = (id: number)                                                    => request<Word>(`/api/words/${id}`)
export const updateWord = (id: number, payload: Partial<Omit<Word, 'id' | 'created_at' | 'updated_at'>> & {progress_source?: string}) => {
  const body = JSON.stringify(translationPayload(payload))
  // Capture language/CSRF context before waiting behind an earlier write.
  const headers = buildRequestHeaders()
  return enqueueWordWrite(id, async () => {
    try { return await request<Word>(`/api/words/${id}`, {method: 'PUT', body, headers}) }
    catch (error) {
      // The server may have committed before the mobile connection dropped.
      // Verify a rating instead of replaying it and recording another review.
      const ratingOnly = payload.knowledge_level != null
        && Object.keys(payload).every(key => key === 'knowledge_level' || key === 'progress_source')
      if (ratingOnly && isUncertainWriteError(error)) {
        try {
          const saved = await request<Word>(`/api/words/${id}`, {headers})
          if (saved.knowledge_level === payload.knowledge_level) return saved
        } catch { /* Preserve the original write error when verification also fails. */ }
      }
      throw error
    }
  })
}
export const deleteWord               = (id: number)                                                    => request<void>(`/api/words/${id}`, {method: 'DELETE'})
export const updateWordKnowledgeLevel = (id: number, level: WordKnowledgeLevel, source = DEFAULT_WORD_PROGRESS_SOURCE) =>
  updateWord(id, {knowledge_level: level, progress_source: source})
export const quickAddWord = (payload: {term: string; topic_ids: number[]; translation_entries: string[]; knowledge_level: number; [key: string]: unknown}) =>
  request<Word>('/api/words', {method: 'POST', body: JSON.stringify({...translationPayload(payload), language: languagePreferences().language})})
export const enrichWord = (term: string) =>
  request<EnrichResult>('/api/words/enrich', {method: 'POST', body: JSON.stringify({term, language: languagePreferences().language, translation_language: languagePreferences().translationLanguage})})
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

export async function exportWordsWorkbook(template = false, options: {languages?: string[]; favoritesOnly?: boolean; topicIds?: number[]} = {}): Promise<void> {
  const params = new URLSearchParams({layout: 'flat'})
  for (const language of options.languages ?? []) params.append('languages', language)
  if (options.favoritesOnly) params.set('favorites_only', 'true')
  for (const id of options.topicIds ?? []) params.append('topic_ids', String(id))
  const response = await fetch(buildApiUrl(template ? '/api/words/import/xlsx/template' : `/api/words/export/xlsx?${params}`), {
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
  const fallbackFilename = response.headers.get('Content-Type')?.includes('application/zip')
    ? 'lexora-vocabulary-languages.zip' : 'lexora-vocabulary.xlsx'
  const filename = filenameStarMatch?.[1]
    ? decodeURIComponent(filenameStarMatch[1])
    : filenameMatch?.[1] ?? fallbackFilename

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
  favoritesOnly?: boolean;
  search?: string; topicId?: number; topicIds?: number[]; pos?: string | string[]; cefr?: string | string[];
  level?: number | number[]; completeness?: string; page?: number; pageSize?: number;
  sort?: SortOption;
  thenSort?: SortOption | null;
  includeSequence?: boolean;
}

export type WordListResponse = {
  words: Word[]; total: number; page: number; page_size: number; total_pages: number;
  ordered_ids?: number[] | null;
}

export type WordSummaryParams = Pick<WordListParams, 'favoritesOnly' | 'search' | 'topicId' | 'topicIds' | 'pos' | 'cefr' | 'level' | 'completeness'>
export type WordKnowledgeSummary = {total: number; scope_total: number; level_counts: Record<number, number>}

function appendWordFilters(q: URLSearchParams, params: WordListParams) {
  if (params.favoritesOnly) q.set('favorites_only', 'true')
  if (params.search?.trim()) q.set('search', params.search.trim())
  if (params.topicId) q.set('topic_id', String(params.topicId))
  for (const id of params.topicIds ?? []) q.append('topic_ids', String(id))
  if (Array.isArray(params.pos)) params.pos.forEach(value => q.append('positions', value))
  else if (params.pos) q.set('pos', params.pos)
  if (Array.isArray(params.cefr)) params.cefr.forEach(value => q.append('cefr_levels', value))
  else if (params.cefr) q.set('cefr', params.cefr)
  if (Array.isArray(params.level)) params.level.forEach(value => q.append('levels', String(value)))
  else if (params.level) q.set('level', String(params.level))
  if (params.completeness) q.set('completeness', params.completeness)
}

export const fetchWordKnowledgeSummary = (params: WordSummaryParams = {}) => {
  const q = new URLSearchParams()
  appendWordFilters(q, params)
  const qs = q.toString()
  return request<WordKnowledgeSummary>(`/api/words/summary${qs ? `?${qs}` : ''}`)
}

export const fetchWordList = (params: WordListParams = {}): Promise<WordListResponse> => {
  const q = new URLSearchParams()
  appendWordFilters(q, params)
  if (params.page) q.set('page', String(params.page))
  if (params.pageSize) q.set('page_size', String(params.pageSize))
  if (params.sort) q.set('sort', params.sort)
  if (params.thenSort !== undefined) q.set('then_sort', params.thenSort ?? 'none')
  if (params.includeSequence) q.set('include_sequence', 'true')
  const qs = q.toString()
  return request<WordListResponse>(`/api/words${qs ? `?${qs}` : ''}`)
}

export const batchUpdateWords = (payload: {
  word_ids: number[];
  knowledge_level?: number;
  add_topic_ids?: number[];
  remove_topic_ids?: number[];
}) => request<{updated: number}>('/api/words/batch', {method: 'PATCH', body: JSON.stringify(payload)})

export function previewWordsWorkbook(file: File, mode: 'add' | 'content', minimumTranslations: number, signal?: AbortSignal): Promise<WorkbookPreview> {
  const formData = new FormData()
  formData.append('file', file)

  formData.append('mode', mode)
  formData.append('minimum_translations', String(minimumTranslations))
  return request<WorkbookPreview>('/api/words/import/xlsx/preview', {
    method: 'POST',
    body: formData,
    signal,
  })
}

export const applyWordsWorkbook = (preview: WorkbookPreview) => request<WorkbookImportResult>('/api/words/import/xlsx/apply', {
  method: 'POST', body: JSON.stringify({batch_id: preview.batch_id, plan_hash: preview.plan_hash}),
})

export const fetchWorkbookRecovery = (batchId: string) => request<unknown>(`/api/words/import/xlsx/${batchId}/recovery`)
