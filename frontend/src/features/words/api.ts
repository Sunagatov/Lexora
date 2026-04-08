import {request} from '../../shared/http'
import type {Word, WordKnowledgeLevel} from '../../shared/http'

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
export const updateWordKnowledgeLevel = (id: number, level: WordKnowledgeLevel)                         => request<Word>(`/api/words/${id}`, {method: 'PUT', body: JSON.stringify({knowledge_level: level})})
export const fetchTrashWords          = ()                                                              => request<(Word & {deleted_at: string})[]>('/api/trash/words')
export const restoreWord              = (id: number)                                                    => request<Word>(`/api/trash/words/${id}/restore`, {method: 'POST'})
