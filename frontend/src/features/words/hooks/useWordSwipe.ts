import {useEffect, useRef, useState} from 'react'
import type {PointerEvent} from 'react'

export const SWIPE_THRESHOLD = 72

export function swipeDirection(dx: number, dy: number): 4 | 5 | null {
  return Math.abs(dx) >= SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.5 ? dx > 0 ? 4 : 5 : null
}

export function useWordSwipe(onSwipe: (level: 4 | 5) => void, disabled: boolean) {
  const start = useRef<{x: number; y: number; id: number; blocked: boolean; horizontal?: boolean} | null>(null)
  const suppressClick = useRef(false)
  const [drag, setDrag] = useState({x: 0, y: 0})
  function reset() { start.current = null; setDrag({x: 0, y: 0}) }
  useEffect(() => {
    if (disabled) {
      if (start.current) start.current.blocked = true
      setDrag({x: 0, y: 0})
    }
  }, [disabled])
  return {
    offset: disabled ? 0 : Math.max(-120, Math.min(120, drag.x)),
    ready: !disabled && swipeDirection(drag.x, drag.y) !== null,
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (!event.isPrimary) return
      // A new interaction must work even if a cancelled drag produced no click.
      suppressClick.current = false
      if (event.pointerType === 'mouse' && event.button !== 0) return
      if ((event.target as HTMLElement).closest('button, input, select, textarea')) return
      // Leave the browser's screen-edge back gesture available.
      if (event.pointerType === 'touch' && (event.clientX < 24 || event.clientX > window.innerWidth - 24)) return
      start.current = {x: event.clientX, y: event.clientY, id: event.pointerId, blocked: disabled}
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const point = start.current
      if (!point || point.id !== event.pointerId) return
      if (event.pointerType === 'mouse' && (event.buttons & 1) === 0) { reset(); return }
      const dx = event.clientX - point.x, dy = event.clientY - point.y
      // Track blocked drags only to distinguish them from taps. A swipe while
      // saving must not turn into a link click or resume when saving finishes.
      if (disabled || point.blocked) {
        point.blocked = true
        if (Math.max(Math.abs(dx), Math.abs(dy)) > 10) suppressClick.current = true
        return
      }
      if (point.horizontal === undefined && Math.max(Math.abs(dx), Math.abs(dy)) > 10) {
        // A deliberate drag must not become a link click, even when it is
        // too diagonal to rate the word or turns into vertical scrolling.
        suppressClick.current = true
        if (Math.abs(dy) >= Math.abs(dx)) { reset(); return }
        if (Math.abs(dx) <= Math.abs(dy) * 1.5) return
        point.horizontal = true
        event.currentTarget.setPointerCapture(event.pointerId)
      }
      if (point.horizontal) { suppressClick.current = true; setDrag({x: dx, y: dy}) }
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      const point = start.current
      if (!point || point.id !== event.pointerId) return
      // Fast flicks may reach pointerup without an intermediate pointermove.
      const dx = event.clientX - point.x, dy = event.clientY - point.y
      if (Math.max(Math.abs(dx), Math.abs(dy)) > 10) suppressClick.current = true
      const level = !disabled && !point.blocked ? swipeDirection(dx, dy) : null
      reset()
      if (level) onSwipe(level)
    },
    onPointerCancel(event: PointerEvent<HTMLElement>) {
      if (event.pointerId === start.current?.id) reset()
    },
    onLostPointerCapture(event: PointerEvent<HTMLElement>) {
      // Touch starts on the inner link. Its capture-loss event bubbles when
      // capture moves to the card; only losing the card's own capture cancels.
      if (event.target === event.currentTarget && event.pointerId === start.current?.id) reset()
    },
    onClickCapture(event: React.MouseEvent<HTMLElement>) {
      if (suppressClick.current) {
        suppressClick.current = false
        // Keyboard and assistive-technology activation must still work after
        // a cancelled drag that never produced a pointer click.
        if (event.detail !== 0) { event.preventDefault(); event.stopPropagation() }
      }
    },
  }
}
