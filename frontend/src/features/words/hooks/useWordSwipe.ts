import {useEffect, useRef} from 'react'
import type {PointerEvent} from 'react'
import {useDragPreview} from '@/shared/hooks/useDragPreview'

export const SWIPE_THRESHOLD = 72

export function swipeDirection(dx: number, dy: number): 4 | 5 | null {
  return Math.abs(dx) >= SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.5 ? dx > 0 ? 4 : 5 : null
}

function scrollOwner(element: HTMLElement) {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const limit = parent.scrollHeight - parent.clientHeight
    if (limit > 0 && /^(auto|scroll)$/.test(getComputedStyle(parent).overflowY)) {
      return {element: parent, top: parent.scrollTop, limit}
    }
  }
  return null
}

export function useWordSwipe(onSwipe: (level: 4 | 5) => void, disabled: boolean) {
  const start = useRef<{x: number; y: number; id: number; blocked: boolean; horizontal?: boolean;
    sideways?: boolean; vertical?: boolean; scroll?: ReturnType<typeof scrollOwner>} | null>(null)
  const suppressClick = useRef(false)
  const {drag, moveDrag, clearDrag} = useDragPreview()
  function reset() { start.current = null; clearDrag() }
  function begin(event: PointerEvent<HTMLElement>) {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return
    if (!event.currentTarget.contains(event.target as Node)
      || (event.target as Element).closest('input, select, textarea, [data-no-swipe]')) return
    // Leave the browser's screen-edge back gesture available.
    if (event.pointerType === 'touch' && (event.clientX < 24 || event.clientX > window.innerWidth - 24)) return
    start.current = {x: event.clientX, y: event.clientY, id: event.pointerId, blocked: disabled}
  }
  useEffect(() => {
    if (disabled) {
      if (start.current) start.current.blocked = true
      clearDrag()
    }
  }, [disabled, clearDrag])
  return {
    offset: disabled ? 0 : Math.max(-120, Math.min(120, drag.x)),
    ready: !disabled && swipeDirection(drag.x, drag.y) !== null,
    onPointerDownCapture(event: PointerEvent<HTMLElement>) {
      if (event.pointerType === 'touch' && !event.isPrimary) {
        suppressClick.current = true
        reset()
        return
      }
      // Controls can stop pointerdown bubbling. Clear a previous drag's click
      // suppression before their handlers run, so the next heart tap works.
      suppressClick.current = false
      begin(event)
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const point = start.current
      if (!point || point.id !== event.pointerId) return
      if (event.pointerType === 'mouse' && (event.buttons & 1) === 0) { reset(); return }
      const dx = event.clientX - point.x, dy = event.clientY - point.y
      // Browsers can latch a sideways start as horizontal and keep sending
      // pointer events instead of starting a vertical pan when the finger turns.
      // Only rescue that sequence; ordinary vertical pans remain native.
      if (!point.vertical && event.pointerType === 'touch' && point.sideways && Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) {
        point.vertical = true
        point.blocked = true
        // Read the scroller once, only when the browser needs help panning.
        point.scroll = scrollOwner(event.currentTarget)
        clearDrag()
      }
      if (point.vertical) {
        suppressClick.current = true
        if (point.scroll) {
          const {element, top, limit} = point.scroll
          element.scrollTop = Math.max(0, Math.min(limit, top - dy))
        }
        return
      }
      // Track a sideways start separately from the stricter rating threshold:
      // a shallow diagonal can also latch the browser without starting a swipe.
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) point.sideways = true
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
      if (point.horizontal) { suppressClick.current = true; moveDrag(dx, dy) }
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
