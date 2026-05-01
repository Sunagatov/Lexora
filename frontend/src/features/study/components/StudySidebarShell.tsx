import type {ComponentProps, CSSProperties, PointerEvent} from 'react'
import {TopicSidebar} from '@/features/topics/components/TopicSidebar'

type TopicSidebarProps = ComponentProps<typeof TopicSidebar>

type Props = {
  drawerOpen: boolean
  setDrawerOpen: (open: boolean) => void
  sidebarWidth: number
  isResizing: boolean
  handleSidebarResizeDown: (event: PointerEvent<HTMLDivElement>) => void
  sidebarProps: TopicSidebarProps
}

export function StudySidebarShell({
  drawerOpen,
  setDrawerOpen,
  sidebarWidth,
  isResizing,
  handleSidebarResizeDown,
  sidebarProps,
}: Props) {
  const desktopSidebarStyle = {'--sidebar-w': `${sidebarWidth}px`} as CSSProperties

  return (
    <>
      <div className={`mobile-drawer-overlay ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(false)} />
      <div className={`mobile-drawer ${drawerOpen ? 'open' : ''}`}>
        <TopicSidebar {...sidebarProps} isMobile />
      </div>

      <aside className={`desktop-sidebar ${isResizing ? 'is-resizing' : ''}`} style={desktopSidebarStyle}>
        <TopicSidebar {...sidebarProps} />
        <div
          className="desktop-sidebar-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          onPointerDown={handleSidebarResizeDown}
        />
      </aside>
    </>
  )
}
