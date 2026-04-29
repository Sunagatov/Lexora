import {useEffect, useState} from 'react'

const MOBILE_BREAKPOINT = '(max-width: 860px)'

export function useResponsivePageSize(mobilePageSize: number, desktopPageSize: number) {
  const [pageSize, setPageSize] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return desktopPageSize
    return window.matchMedia(MOBILE_BREAKPOINT).matches ? mobilePageSize : desktopPageSize
  })

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return

    const media = window.matchMedia(MOBILE_BREAKPOINT)
    const update = () => setPageSize(media.matches ? mobilePageSize : desktopPageSize)

    update()
    if (media.addEventListener) {
      media.addEventListener('change', update)
      return () => media.removeEventListener('change', update)
    }

    media.addListener(update)
    return () => media.removeListener?.(update)
  }, [desktopPageSize, mobilePageSize])

  return pageSize
}
