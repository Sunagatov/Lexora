import {useEffect, useRef, useState, type PointerEvent as ReactPointerEvent} from 'react'

const SIDEBAR_WIDTH_KEY = 'study_sidebar_width'
const DEFAULT_SIDEBAR_WIDTH = 300
const MIN_SIDEBAR_WIDTH = 240
const MAX_SIDEBAR_WIDTH = 520

function clampSidebarWidth(width: number) {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width))
}

function loadSidebarWidth() {
  if (typeof window === 'undefined') return DEFAULT_SIDEBAR_WIDTH
  const raw = Number.parseInt(window.localStorage.getItem(SIDEBAR_WIDTH_KEY) ?? '', 10)
  return Number.isFinite(raw) ? clampSidebarWidth(raw) : DEFAULT_SIDEBAR_WIDTH
}

export function useResizableSidebarWidth() {
  const [sidebarWidth, setSidebarWidth] = useState(() => loadSidebarWidth())
  const [isResizing, setIsResizing] = useState(false)
  const dragStartRef = useRef({x: 0, width: sidebarWidth})
  const isResizingRef = useRef(isResizing)
  const resizeListenersRef = useRef<{
    move?: (event: PointerEvent) => void
    up?: () => void
  }>({})

  useEffect(() => {
    isResizingRef.current = isResizing
  }, [isResizing])

  useEffect(() => {
    if (isResizing) return
    window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth))
  }, [sidebarWidth, isResizing])

  useEffect(() => {
    return () => {
      const {move, up} = resizeListenersRef.current
      if (move) window.removeEventListener('pointermove', move)
      if (up) {
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', up)
      }
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [])

  function handleSidebarResizeDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    event.preventDefault()
    dragStartRef.current = {x: event.clientX, width: sidebarWidth}
    setIsResizing(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const move = (moveEvent: PointerEvent) => {
      if (!isResizingRef.current) return
      const nextWidth = clampSidebarWidth(dragStartRef.current.width + (moveEvent.clientX - dragStartRef.current.x))
      setSidebarWidth(nextWidth)
    }

    const up = () => {
      if (!isResizingRef.current) return
      setIsResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      resizeListenersRef.current = {}
    }

    resizeListenersRef.current = {move, up}
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  return {
    sidebarWidth,
    isResizing,
    handleSidebarResizeDown,
  }
}
