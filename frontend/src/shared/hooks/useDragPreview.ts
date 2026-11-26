import {useCallback, useEffect, useRef, useState} from 'react'

const resting = {x: 0, y: 0}

export function useDragPreview() {
  const [drag, setDrag] = useState(resting)
  const latest = useRef(resting)
  const frame = useRef<number | null>(null)
  const cancelFrame = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
  }, [])
  useEffect(() => cancelFrame, [cancelFrame])

  function moveDrag(x: number, y: number) {
    latest.current = {x, y}
    if (frame.current !== null) return
    frame.current = requestAnimationFrame(() => {
      frame.current = null
      setDrag(latest.current)
    })
  }

  const clearDrag = useCallback(() => {
    cancelFrame()
    setDrag(resting)
  }, [cancelFrame])

  return {drag, moveDrag, clearDrag}
}
