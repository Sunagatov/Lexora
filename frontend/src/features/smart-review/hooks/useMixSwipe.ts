import {useEffect, useRef, useState} from 'react'
import type {PointerEvent} from 'react'
import {swipeAction, type SwipeRating} from '../model/swipeSession'

export function useMixSwipe(onAction: (action: SwipeRating | 'skip') => void, disabled: boolean) {
  const start = useRef<{x: number; y: number; id: number; horizontalOnly: boolean} | null>(null)
  const [drag, setDrag] = useState({x: 0, y: 0})
  function reset() { start.current = null; setDrag({x: 0, y: 0}) }
  useEffect(() => {
    if (disabled) { start.current = null; setDrag({x: 0, y: 0}) }
  }, [disabled])
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
        const horizontalOnly = !!target.closest('[data-mix-scrollable="true"]')
          && !target.closest('[data-mix-gesture-surface]')
        start.current = {x: e.clientX, y: e.clientY, id: e.pointerId, horizontalOnly}
        e.currentTarget.setPointerCapture(e.pointerId)
      },
      onPointerMove(e: PointerEvent<HTMLElement>) {
        if (!start.current || start.current.id !== e.pointerId) return
        if (disabled || (e.pointerType === 'mouse' && !(e.buttons & 1))) { reset(); return }
        const x = e.clientX - start.current.x, y = e.clientY - start.current.y
        if (Math.max(Math.abs(x), Math.abs(y)) <= 10) return
        // Long translations/examples must remain readable with native scrolling.
        if (start.current.horizontalOnly && Math.abs(y) >= Math.abs(x)) { reset(); return }
        setDrag({x, y})
      },
      onPointerUp(e: PointerEvent<HTMLElement>) {
        if (!start.current || start.current.id !== e.pointerId) return
        const point = start.current
        let action = disabled ? null : swipeAction(e.clientX - point.x, e.clientY - point.y)
        if (point.horizontalOnly && (action === 3 || action === 'skip')) action = null
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
