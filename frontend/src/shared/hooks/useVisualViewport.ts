import {useLayoutEffect, type RefObject} from 'react'

export function useVisualViewport(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const element = ref.current
    const viewport = window.visualViewport
    if (!element || !viewport) return

    const update = () => {
      // Pinch zoom should magnify the interface without reflowing it.
      if (viewport.scale !== 1 || viewport.height <= 0) {
        element.style.removeProperty('--visual-viewport-height')
        element.style.removeProperty('--visual-viewport-top')
        return
      }
      element.style.setProperty('--visual-viewport-height', `${viewport.height}px`)
      element.style.setProperty('--visual-viewport-top', `${viewport.offsetTop}px`)
    }
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update, {passive: true})
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  }, [ref])
}
