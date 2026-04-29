import {request} from '@/shared/api/http'
import type {StudyQueue} from '@/shared/types'

export const fetchSmartReview        = ()               => request<StudyQueue>('/api/smart-review')
export const completeSmartReviewItem = (itemId: number) => request<StudyQueue>(`/api/smart-review/items/${itemId}/complete`, {method: 'POST'})
export const refreshSmartReview      = ()               => request<StudyQueue>('/api/smart-review/refresh', {method: 'POST'})
