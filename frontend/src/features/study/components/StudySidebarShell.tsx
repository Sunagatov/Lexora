import {useRef, useState, type ComponentProps, type CSSProperties, type PointerEvent, type TouchEvent} from 'react'
import {TopicSidebar} from '@/features/topics/components/TopicSidebar'

type TopicSidebarProps = ComponentProps<typeof TopicSidebar>

const COLLAPSED_WIDTH = 64

type Props = {
  drawerOpen: boolean
  setDrawerOpen: (open: boolean) => void
  sidebarWidth: number
  sidebarCollapsed: boolean
  isResizing: boolean
  handleSidebarResizeDown: (event: PointerEvent<HTMLDivElement>) => void
  sidebarProps: TopicSidebarProps
}

export function StudySidebarShell({
  drawerOpen,
  setDrawerOpen,
  sidebarWidth,
  sidebarCollapsed,
  isResizing,
  handleSidebarResizeDown,
  sidebarProps,
}: Props) {
  const effectiveWidth = sidebarCollapsed ? COLLAPSED_WIDTH : sidebarWidth
  const desktopSidebarStyle = {'--sidebar-w': `${effectiveWidth}px`} as CSSProperties
  const touchStartXRef = useRef<number | null>(null)
  const touchStartYRef = useRef<number | null>(null)
  const [swipeOffset, setSwipeOffset] = useState(0)

  function resetSwipe() {
    touchStartXRef.current = null
    touchStartYRef.current = null
    setSwipeOffset(0)
  }

  function handleDrawerTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (!drawerOpen) return
    const touch = event.touches[0]
    touchStartXRef.current = touch.clientX
    touchStartYRef.current = touch.clientY
  }

  function handleDrawerTouchMove(event: TouchEvent<HTMLDivElement>) {
    if (!drawerOpen || touchStartXRef.current === null || touchStartYRef.current === null) return
    const touch = event.touches[0]
    const deltaX = touch.clientX - touchStartXRef.current
    const deltaY = touch.clientY - touchStartYRef.current

    if (Math.abs(deltaY) > Math.abs(deltaX) || deltaX > 0) {
      setSwipeOffset(0)
      return
    }

    setSwipeOffset(Math.max(deltaX, -140))
  }

  function handleDrawerTouchEnd() {
    if (swipeOffset <= -64) {
      setDrawerOpen(false)
    }
    resetSwipe()
  }

  return (
    <>
      <div className={`mobile-drawer-overlay ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(false)} />
      <div
        className={`mobile-drawer ${drawerOpen ? 'open' : ''}`}
        style={drawerOpen && swipeOffset !== 0 ? {transform: `translateX(${swipeOffset}px)`} : undefined}
        onTouchStart={handleDrawerTouchStart}
        onTouchMove={handleDrawerTouchMove}
        onTouchEnd={handleDrawerTouchEnd}
        onTouchCancel={resetSwipe}
      >
        <TopicSidebar {...sidebarProps} isMobile />
      </div>

      <aside
        className={`desktop-sidebar ${isResizing ? 'is-resizing' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
        style={desktopSidebarStyle}
      >
        <TopicSidebar {...sidebarProps} />
        {!sidebarCollapsed && (
          <div
            className="desktop-sidebar-resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            onPointerDown={handleSidebarResizeDown}
          />
        )}
      </aside>
    </>
  )
}
