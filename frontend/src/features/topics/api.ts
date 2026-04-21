import {request} from '../../shared/http'
import type {Topic} from '../../shared/types'

export const fetchTopics = () => request<Topic[]>('/api/topics')

export type TopicUpdatePayload = {
  name?: string
  description?: string | null
  parent_topic_id?: number | null
}

export const createTopic = (name: string, parentTopicId: number | null = null) =>
  request<Topic>('/api/topics', {
    method: 'POST',
    body: JSON.stringify({name, parent_topic_id: parentTopicId, is_active: true}),
  })

export const updateTopic = (id: number, payload: TopicUpdatePayload) =>
  request<Topic>(`/api/topics/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })

export const deleteTopic = (id: number, deleteWords = false) =>
  request<void>(`/api/topics/${id}?delete_words=${deleteWords}`, {method: 'DELETE'})

export const restoreTopic = (id: number, restoreWords = false) =>
  request<Topic>(`/api/trash/topics/${id}/restore?restore_words=${restoreWords}`, {method: 'POST'})

export const fetchTrashTopics = () => request<(Topic & {deleted_at: string})[]>('/api/trash/topics')
