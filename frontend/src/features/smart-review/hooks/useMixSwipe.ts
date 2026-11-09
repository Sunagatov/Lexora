import {useEffect, useRef, useState} from 'react'
import type {PointerEvent} from 'react'
import {swipeAction, type SwipeRating} from '../model/swipeSession'

export function useMixSwipe(onAction: (action: SwipeRating | 'skip') => void, disabled: boolean) {
  const start = useRef<{x: number; y: number; id: number} | null>(null)
  const [drag, setDrag] = useState({x: 0, y: 0})
  function reset() { start.current = null; setDrag({x: 0, y: 0}) }
  useEffect(() => {
    if (disabled) { start.current = null; setDrag({x: 0, y: 0}) }
  }, [disabled])
  return {drag, action: swipeAction(drag.x, drag.y),
    events: {
      onPointerDown(e: PointerEvent<HTMLElement>) {
        if (disabled || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return
        if ((e.target as HTMLElement).closest('button, a, audio, input, [data-no-swipe]')) return
        if (e.pointerType === 'touch' && (e.clientX < 24 || e.clientX > window.innerWidth - 24)) return
        start.current = {x: e.clientX, y: e.clientY, id: e.pointerId}
        e.currentTarget.setPointerCapture(e.pointerId)
      },
      onPointerMove(e: PointerEvent<HTMLElement>) {
        if (!start.current || start.current.id !== e.pointerId) return
        if (disabled || (e.pointerType === 'mouse' && !(e.buttons & 1))) { reset(); return }
        setDrag({x: e.clientX - start.current.x, y: e.clientY - start.current.y})
      },
      onPointerUp(e: PointerEvent<HTMLElement>) {
        if (!start.current || start.current.id !== e.pointerId) return
        const action = disabled ? null : swipeAction(e.clientX - start.current.x, e.clientY - start.current.y)
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
