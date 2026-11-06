import {useEffect, useRef, useState} from 'react'
import type {StudyQueue} from '../types/studyQueueTypes'
import {loadSwipeSession, saveSwipeSession, type SwipeRating, type SwipeSession} from '../model/swipeSession'
import {useSmartReview} from './useSmartReview'
import {useWordUpdate} from '@/features/words/hooks/useWordUpdate'

export function useSwipeSession(queue: StudyQueue, language: string) {
  const [session, setSession] = useState(() => loadSwipeSession(queue, language))
  const current = useRef(session)
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const failedRating = useRef<SwipeRating | null>(null)
  const update = useWordUpdate(() => {}, 'smart_review')
  const review = useSmartReview(false)
  const items = new Map(queue.items.map(item => [item.id, item]))
  const item = items.get(session.order[session.cursor])

  function change(next: SwipeSession) {
    current.current = next
    saveSwipeSession(next, language)
    setSession(next)
  }
  useEffect(() => { saveSwipeSession(current.current, language) }, [language])

  async function rate(level: SwipeRating) {
    if (!item || lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    failedRating.current = level
    try {
      // A saved rating with failed queue completion only needs the second request retried.
      const pending = current.current.pending
      if (!pending || pending.id !== item.id || pending.level !== level) {
        await update.updateLevelAsync(item.word_id, level)
        change({...current.current, pending: {id: item.id, level}})
      }
      if (!item.is_completed) await review.completeItemAsync(item.id)
      change({...current.current, pending: null, cursor: current.current.cursor + 1,
        decisions: {...current.current.decisions, [item.id]: level}})
      failedRating.current = null
    } catch {
      setError(current.current.pending
        ? 'Your rating is saved. Review progress could not be saved; retry to continue.'
        : 'Could not save your rating. Your card has not moved; please retry.')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  function navigate(cursor: number) {
    if (lock.current || current.current.pending) return
    setError('')
    failedRating.current = null
    change({...current.current, cursor: Math.max(0, Math.min(cursor, session.order.length))})
  }
  function skip() {
    if (!item || lock.current || current.current.pending) return
    setError('')
    failedRating.current = null
    change({...current.current, cursor: session.cursor + 1, decisions: {...session.decisions, [item.id]: 'skip'}})
  }
  function revisit(ids: number[]) {
    if (!ids.length || lock.current || current.current.pending) return
    change({...current.current, order: ids, cursor: 0})
  }
  return {session, item, busy, error, rate, skip, navigate, revisit,
    retry: () => {
      const level = current.current.pending?.level ?? failedRating.current
      if (level) void rate(level)
    },
    blocked: busy || !!session.pending,
    hasRecovery: !!session.pending,
  }
}
