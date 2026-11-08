import type {StudyQueue} from '../types/studyQueueTypes'

export type SwipeRating = 3 | 4 | 5
export type SwipeDecision = SwipeRating | 'skip' | 'reviewed'
export type SwipeSession = {
  version: 1
  queueId: number
  generatedAt: string
  order: number[]
  cursor: number
  decisions: Record<number, SwipeDecision>
  pending: {id: number; level: SwipeRating} | null
}

export const SWIPE_DISTANCE = 80
export function swipeAction(x: number, y: number): SwipeRating | 'skip' | null {
  const horizontal = Math.abs(x) > Math.abs(y) * 1.25
  const vertical = Math.abs(y) > Math.abs(x) * 1.25
  if (horizontal && Math.abs(x) >= SWIPE_DISTANCE) return x > 0 ? 4 : 5
  if (vertical && Math.abs(y) >= SWIPE_DISTANCE) return y > 0 ? 'skip' : 3
  return null
}

export function swipeStorageKey(language: string) { return `lexora-mix-swipe-v1:${language}` }

export function loadSwipeSession(queue: StudyQueue, language: string): SwipeSession {
  const ids = queue.items.slice().sort((a, b) => a.position - b.position).map(item => item.id)
  const decisions: Record<number, SwipeDecision> = {}
  for (const item of queue.items) {
    if (item.is_completed) decisions[item.id] = [3, 4, 5].includes(item.word.knowledge_level ?? 0)
      ? item.word.knowledge_level as SwipeRating : 'reviewed'
  }
  const firstUnreviewed = ids.findIndex(id => !decisions[id])
  const initial: SwipeSession = {version: 1, queueId: queue.id, generatedAt: queue.generated_at,
    order: ids, cursor: firstUnreviewed < 0 ? ids.length : firstUnreviewed, decisions, pending: null}
  try {
    const stored = JSON.parse(localStorage.getItem(swipeStorageKey(language)) ?? 'null')
    if (!stored || stored.version !== 1 || stored.queueId !== queue.id || stored.generatedAt !== queue.generated_at
      || !Array.isArray(stored.order) || !stored.order.length || !stored.order.every((id: unknown) => typeof id === 'number' && ids.includes(id))
      || new Set(stored.order).size !== stored.order.length || !Number.isInteger(stored.cursor)
      || stored.cursor < 0 || stored.cursor > stored.order.length) return initial
    for (const [id, decision] of Object.entries(stored.decisions ?? {})) {
      if (ids.includes(Number(id)) && [3, 4, 5, 'skip', 'reviewed'].includes(decision as SwipeDecision)) decisions[Number(id)] = decision as SwipeDecision
    }
    const pending = stored.pending && stored.pending.id === stored.order[stored.cursor] && [3, 4, 5].includes(stored.pending.level)
      ? {id: stored.pending.id as number, level: stored.pending.level as SwipeRating} : null
    return {...initial, order: stored.order, cursor: stored.cursor, decisions, pending}
  } catch { return initial }
}

/** Store IDs and navigation only, never vocabulary text or credentials. */
export function saveSwipeSession(session: SwipeSession, language: string) {
  try {
    const key = swipeStorageKey(language)
    let current: {queueId?: number; generatedAt?: string} | null = null
    try { current = JSON.parse(localStorage.getItem(key) ?? 'null') } catch { /* Replace corrupt metadata with this valid session. */ }
    // A late save from an older queue must not overwrite a newly opened mix.
    if (current?.generatedAt && Date.parse(current.generatedAt) > Date.parse(session.generatedAt)) return
    localStorage.setItem(key, JSON.stringify(session))
  } catch { /* Review still works when storage is full or blocked. */ }
}
