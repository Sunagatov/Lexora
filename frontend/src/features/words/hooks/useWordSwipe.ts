import {useRef, useState} from 'react'
import type {PointerEvent} from 'react'

export const SWIPE_THRESHOLD = 72

export function swipeDirection(dx: number, dy: number): 4 | 5 | null {
  return Math.abs(dx) >= SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.5 ? dx > 0 ? 4 : 5 : null
}

export function useWordSwipe(onSwipe: (level: 4 | 5) => void, disabled: boolean) {
  const start = useRef<{x: number; y: number; id: number; horizontal?: boolean} | null>(null)
  const suppressClick = useRef(false)
  const [offset, setOffset] = useState(0)
  function reset() { start.current = null; setOffset(0) }
  return {
    offset,
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (!event.isPrimary) return
      // A new interaction must work even if a cancelled drag produced no click.
      suppressClick.current = false
      if (disabled || (event.pointerType === 'mouse' && event.button !== 0)) return
      if ((event.target as HTMLElement).closest('button, input, select, textarea')) return
      // Leave the browser's screen-edge back gesture available.
      if (event.pointerType === 'touch' && (event.clientX < 24 || event.clientX > window.innerWidth - 24)) return
      start.current = {x: event.clientX, y: event.clientY, id: event.pointerId}
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const point = start.current
      if (!point || point.id !== event.pointerId) return
      const dx = event.clientX - point.x, dy = event.clientY - point.y
      if (point.horizontal === undefined && Math.max(Math.abs(dx), Math.abs(dy)) > 10) {
        if (Math.abs(dy) >= Math.abs(dx)) { reset(); return }
        point.horizontal = true
        event.currentTarget.setPointerCapture(event.pointerId)
      }
      if (point.horizontal) { suppressClick.current = true; setOffset(Math.max(-120, Math.min(120, dx))) }
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      const point = start.current
      if (!point || point.id !== event.pointerId) return
      const level = !disabled && point.horizontal ? swipeDirection(event.clientX - point.x, event.clientY - point.y) : null
      reset()
      if (level) { suppressClick.current = true; onSwipe(level) }
    },
    onPointerCancel: reset,
    onLostPointerCapture(event: PointerEvent<HTMLElement>) {
      // Touch starts on the inner link. Its capture-loss event bubbles when
      // capture moves to the card; only losing the card's own capture cancels.
      if (event.target === event.currentTarget && event.pointerId === start.current?.id) reset()
    },
    onClickCapture(event: React.MouseEvent<HTMLElement>) {
      if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false }
    },
  }
}
