import {useEffect, useRef, useState, type ComponentProps, type CSSProperties, type PointerEvent, type TouchEvent} from 'react'
import {TopicSidebar} from '@/features/topics/components/TopicSidebar'
import {useIsMobile} from '@/shared/hooks/useIsMobile'

type TopicSidebarProps = ComponentProps<typeof TopicSidebar>

const COLLAPSED_WIDTH = 64
type DrawerGesture = {id: number; x: number; y: number; direction: 'pending' | 'dismiss'; offset: number}

type Props = {
  overlayOnly?: boolean
  drawerOpen: boolean
  setDrawerOpen: (open: boolean) => void
  sidebarWidth: number
  sidebarCollapsed: boolean
  isResizing: boolean
  handleSidebarResizeDown: (event: PointerEvent<HTMLDivElement>) => void
  sidebarProps: TopicSidebarProps
}

export function StudySidebarShell({
  overlayOnly = false,
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
  const gestureRef = useRef<DrawerGesture | null>(null)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const drawerRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()

  useEffect(() => {
    if (!isMobile && !overlayOnly && drawerOpen) setDrawerOpen(false)
  }, [isMobile, overlayOnly, drawerOpen, setDrawerOpen])

  useEffect(() => {
    if (!drawerOpen || (!isMobile && !overlayOnly)) return
    const active = document.activeElement as HTMLElement | null
    drawerRef.current?.querySelector('button')?.focus({preventScroll: true})
    return () => { if (active?.isConnected) active.focus({preventScroll: true}) }
  }, [drawerOpen, isMobile, overlayOnly])

  function resetSwipe() {
    gestureRef.current = null
    setSwipeOffset(0)
  }

  function handleDrawerTouchStart(event: TouchEvent<HTMLDivElement>) {
    resetSwipe()
    const target = event.target
    // React portals bubble through the drawer even though their dialogs are
    // outside it. Their gestures must never dismiss the navigation behind them.
    if (!drawerOpen || event.touches.length !== 1 || !(target instanceof Element) ||
      !event.currentTarget.contains(target) || target.closest('input, textarea, select, [contenteditable="true"], [data-no-swipe]')) return
    const touch = event.touches[0]
    gestureRef.current = {id: touch.identifier, x: touch.clientX, y: touch.clientY, direction: 'pending', offset: 0}
  }

  function handleDrawerTouchMove(event: TouchEvent<HTMLDivElement>) {
    if (!drawerOpen || event.touches.length !== 1) { resetSwipe(); return }
    const gesture = gestureRef.current
    const touch = Array.from(event.touches).find(touch => touch.identifier === gesture?.id)
    if (!gesture || !touch) return
    const deltaX = touch.clientX - gesture.x
    const deltaY = touch.clientY - gesture.y

    if (gesture.direction === 'pending') {
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 10) return
      // Once a gesture starts scrolling, it cannot turn into a close gesture.
      if (deltaX >= 0 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.25) { resetSwipe(); return }
      gesture.direction = 'dismiss'
    }
    gesture.offset = Math.max(-140, Math.min(deltaX, 0))
    setSwipeOffset(gesture.offset)
  }

  function handleDrawerTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const gesture = gestureRef.current
    const dismiss = drawerOpen && event.touches.length === 0 && gesture?.direction === 'dismiss' && gesture.offset <= -64
    resetSwipe()
    if (dismiss) setDrawerOpen(false)
  }

  return (
    <>
      <div className={`mobile-drawer-overlay ${overlayOnly ? 'account-drawer-overlay' : ''} ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(false)} />
      <div
        ref={drawerRef}
        id="mobile-topic-drawer"
        inert={!drawerOpen}
        aria-hidden={!drawerOpen}
        className={`mobile-drawer ${overlayOnly ? 'account-topic-drawer' : ''} ${drawerOpen ? 'open' : ''}`}
        data-swiping={swipeOffset !== 0 || undefined}
        onKeyDown={event => {
          if (event.key === 'Escape' && !event.defaultPrevented) setDrawerOpen(false)
        }}
        style={drawerOpen && swipeOffset !== 0 ? {transform: `translateX(${swipeOffset}px)`} : undefined}
        onTouchStart={handleDrawerTouchStart}
        onTouchMove={handleDrawerTouchMove}
        onTouchEnd={handleDrawerTouchEnd}
        onTouchCancel={resetSwipe}
      >
        <TopicSidebar {...sidebarProps} isMobile />
      </div>

      {!overlayOnly && <aside
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
      </aside>}
    </>
  )
}
