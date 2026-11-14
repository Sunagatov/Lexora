import {useEffect, useRef, useState} from 'react'
import type {PointerEvent} from 'react'

export const SWIPE_THRESHOLD = 72

export function swipeDirection(dx: number, dy: number): 4 | 5 | null {
  return Math.abs(dx) >= SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.5 ? dx > 0 ? 4 : 5 : null
}

function scrollOwner(element: HTMLElement): HTMLElement | null {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (parent.scrollHeight > parent.clientHeight && /^(auto|scroll)$/.test(getComputedStyle(parent).overflowY)) return parent
  }
  return null
}

export function useWordSwipe(onSwipe: (level: 4 | 5) => void, disabled: boolean) {
  const start = useRef<{x: number; y: number; id: number; blocked: boolean; horizontal?: boolean;
    sideways?: boolean; vertical?: boolean; scroll: HTMLElement | null; scrollTop: number} | null>(null)
  const suppressClick = useRef(false)
  const [drag, setDrag] = useState({x: 0, y: 0})
  function reset() { start.current = null; setDrag({x: 0, y: 0}) }
  function begin(event: PointerEvent<HTMLElement>, fromAction = false) {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return
    if (!event.currentTarget.contains(event.target as Node)
      || (event.target as Element).closest('input, select, textarea, [data-no-swipe]')
      || (!fromAction && (event.target as Element).closest('button'))) return
    // Leave the browser's screen-edge back gesture available.
    if (event.pointerType === 'touch' && (event.clientX < 24 || event.clientX > window.innerWidth - 24)) return
    const scroll = scrollOwner(event.currentTarget)
    start.current = {x: event.clientX, y: event.clientY, id: event.pointerId, blocked: disabled,
      scroll, scrollTop: scroll?.scrollTop ?? 0}
  }
  useEffect(() => {
    if (disabled) {
      if (start.current) start.current.blocked = true
      setDrag({x: 0, y: 0})
    }
  }, [disabled])
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
      // Badge/menu buttons are also common starting points for left swipes.
      // Observe them before they stop bubbling, but leave portalled dialogs alone.
      if (event.currentTarget.contains(event.target as Node)
        && (event.target as Element).closest('button')) begin(event, true)
    },
    onPointerDown(event: PointerEvent<HTMLElement>) {
      // A new interaction must work even if a cancelled drag produced no click.
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
        setDrag({x: 0, y: 0})
      }
      if (point.vertical) {
        suppressClick.current = true
        if (point.scroll) {
          point.scroll.scrollTop = Math.max(0, Math.min(point.scroll.scrollHeight - point.scroll.clientHeight, point.scrollTop - dy))
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
