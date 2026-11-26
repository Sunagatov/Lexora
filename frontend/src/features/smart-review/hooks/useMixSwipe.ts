import {useEffect, useRef} from 'react'
import type {PointerEvent} from 'react'
import {useDragPreview} from '@/shared/hooks/useDragPreview'
import {swipeAction, type SwipeRating} from '../model/swipeSession'

export function useMixSwipe(onAction: (action: SwipeRating | 'skip') => void, disabled: boolean) {
  const start = useRef<{x: number; y: number; id: number; reading: HTMLElement | null;
    captured?: boolean; sideways?: boolean; scrollTop?: number} | null>(null)
  const {drag, moveDrag, clearDrag} = useDragPreview()
  function reset() { start.current = null; clearDrag() }
  useEffect(() => {
    if (disabled) { start.current = null; clearDrag() }
  }, [disabled, clearDrag])
  return {drag, action: swipeAction(drag.x, drag.y),
    events: {
      onPointerDown(e: PointerEvent<HTMLElement>) {
        // A pinch or second touch must not finish as an accidental rating.
        if (e.pointerType === 'touch' && !e.isPrimary) { reset(); return }
        if (disabled || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return
        const target = e.target as HTMLElement
        if (!e.currentTarget.contains(target)
          || target.closest('button, a, audio, input, select, textarea, [data-no-swipe]')) return
        if (e.pointerType === 'touch' && (e.clientX < 24 || e.clientX > window.innerWidth - 24)) return
        const reading = target.closest('[data-mix-gesture-surface]') ? null
          : target.closest<HTMLElement>('[data-mix-scrollable="true"]')
        start.current = {x: e.clientX, y: e.clientY, id: e.pointerId, reading}
      },
      onPointerMove(e: PointerEvent<HTMLElement>) {
        const point = start.current
        if (!point || point.id !== e.pointerId) return
        if (disabled || (e.pointerType === 'mouse' && !(e.buttons & 1))) { reset(); return }
        const x = e.clientX - point.x, y = e.clientY - point.y
        const horizontal = Math.abs(x), vertical = Math.abs(y)
        if (point.reading) {
          // Ordinary vertical pans stay native. Recover if the browser still
          // delivers a sideways-started touch after it turns into a scroll.
          if (point.scrollTop === undefined && e.pointerType === 'touch' && point.sideways && vertical > 10 && vertical >= horizontal) {
            point.scrollTop = point.reading.scrollTop
            clearDrag()
          }
          if (point.scrollTop !== undefined) { point.reading.scrollTop = point.scrollTop - y; return }
          if (vertical > 10 && vertical >= horizontal) { reset(); return }
          if (horizontal > 10 && horizontal > vertical) point.sideways = true
          if (!point.captured && horizontal <= vertical * 1.25) return
        }
        if (!point.captured) {
          if (Math.max(horizontal, vertical) <= 10) return
          point.captured = true
          e.currentTarget.setPointerCapture(e.pointerId)
        }
        moveDrag(x, y)
      },
      onPointerUp(e: PointerEvent<HTMLElement>) {
        if (!start.current || start.current.id !== e.pointerId) return
        const point = start.current
        let action = disabled || point.scrollTop !== undefined ? null : swipeAction(e.clientX - point.x, e.clientY - point.y)
        if (point.reading && (action === 3 || action === 'skip')) action = null
        reset()
        if (action !== null) onAction(action)
      },
      onPointerCancel(e: PointerEvent<HTMLElement>) {
        if (e.pointerId === start.current?.id) reset()
      },
      onLostPointerCapture(e: PointerEvent<HTMLElement>) {
        // The touched child loses implicit capture when the surface takes it.
        // Only loss of the surface's own capture cancels this gesture.
        if (e.target === e.currentTarget && e.pointerId === start.current?.id) reset()
      },
    },
  }
}
