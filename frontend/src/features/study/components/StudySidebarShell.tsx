import type {ComponentProps, CSSProperties, PointerEvent} from 'react'
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

  return (
    <>
      <div className={`mobile-drawer-overlay ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(false)} />
      <div className={`mobile-drawer ${drawerOpen ? 'open' : ''}`}>
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
