import {useEffect, useState} from 'react'
import type {RefObject} from 'react'

/** Keep the floating button out of the way of mobile card controls. */
export function useQuickAddOverlap(button: RefObject<HTMLButtonElement | null>, enabled: boolean) {
  const [overlapping, setOverlapping] = useState(false)

  useEffect(() => {
    if (!enabled) return
    const mobile = window.matchMedia('(max-width: 860px)')
    let frame = 0
    function check() {
      frame = 0
      const fab = button.current
      if (!fab || !mobile.matches) { setOverlapping(false); return }
      const rect = fab.getBoundingClientRect()
      const controls = document.querySelectorAll('.word-card button')
      setOverlapping(Array.from(controls).some(control => {
        const target = control.getBoundingClientRect()
        // The compact rating pill has an invisible 44px touch pad in CSS.
        const rating = control.classList.contains('level-badge-btn')
        const verticalPad = rating ? Math.max(0, (44 - target.height) / 2) : 0
        const horizontalPad = rating ? 8 : 0
        return target.width > 0 && target.height > 0
          && target.left - horizontalPad < rect.right + 4 && target.right + horizontalPad > rect.left - 4
          && target.top - verticalPad < rect.bottom + 4 && target.bottom + verticalPad > rect.top - 4
      }))
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(check) }
    // Cards arrive asynchronously and can change height after a rating or edit.
    const observer = new MutationObserver(schedule)
    observer.observe(document.querySelector('.app-body') ?? document.body, {childList: true, subtree: true})
    document.addEventListener('scroll', schedule, {capture: true, passive: true})
    window.addEventListener('resize', schedule)
    mobile.addEventListener('change', schedule)
    schedule()
    return () => {
      observer.disconnect()
      document.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
      mobile.removeEventListener('change', schedule)
      cancelAnimationFrame(frame)
    }
  }, [button, enabled])

  return enabled && overlapping
}
