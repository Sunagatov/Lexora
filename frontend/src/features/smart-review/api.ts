import {request} from '../../shared/http'
import type {StudyQueue} from '../../shared/http'

export const fetchSmartReview        = ()             => request<StudyQueue>('/api/smart-review')
export const completeSmartReviewItem = (itemId: number) => request<StudyQueue>(`/api/smart-review/items/${itemId}/complete`, {method: 'POST'})
