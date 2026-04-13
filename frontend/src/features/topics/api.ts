import {request} from '../../shared/http'
import type {Topic} from '../../shared/http'

export const fetchTopics  = ()                                    => request<Topic[]>('/api/topics')
export const createTopic  = (name: string)                               => request<Topic>('/api/topics', {method: 'POST', body: JSON.stringify({name, is_active: true})})
export const deleteTopic  = (id: number, deleteWords = false)     => request<void>(`/api/topics/${id}?delete_words=${deleteWords}`, {method: 'DELETE'})
export const restoreTopic = (id: number, restoreWords = false)    => request<Topic>(`/api/trash/topics/${id}/restore?restore_words=${restoreWords}`, {method: 'POST'})
export const fetchTrashTopics = ()                                => request<(Topic & {deleted_at: string})[]>('/api/trash/topics')
