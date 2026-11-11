import {request} from '@/shared/api/http'
import type {StudyQueue} from '@/features/smart-review/types/studyQueueTypes'

export type ReviewCompletion = {queue_id: number; item_id: number; completed_count: number; completed_at: string | null}

export const fetchSmartReview        = ()               => request<StudyQueue>('/api/smart-review')
export const completeSmartReviewItem = (itemId: number) => request<ReviewCompletion | StudyQueue>(`/api/smart-review/items/${itemId}/complete?compact=true`, {method: 'POST'})
export const refreshSmartReview      = ()               => request<StudyQueue>('/api/smart-review/refresh', {method: 'POST'})
