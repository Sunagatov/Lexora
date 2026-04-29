import type {ReactNode, RefObject} from 'react'
import {SortMenu} from '@/features/topics/components/TopicSortMenu'
import {SORT_OPTIONS, type SortMode} from '@/features/topics/model/topicSort'

type Props = {
  title: string
  count: number
  collapsed: boolean
  onToggleCollapsed: () => void
  sortMode: SortMode
  sortButtonRef: RefObject<HTMLButtonElement | null>
  sortOpen: boolean
  onToggleSort: () => void
  onCloseSort: () => void
  onSelectSort: (mode: SortMode) => void
  meta?: ReactNode
  children: ReactNode
}

export function TopicSidebarGroup({
  title, count, collapsed, onToggleCollapsed,
  sortMode, sortButtonRef, sortOpen, onToggleSort, onCloseSort, onSelectSort,
  meta, children,
}: Props) {
  return (
    <div className="sidebar-group">
      <div className="sidebar-group-header">
        <button type="button" className="sidebar-group-toggle" onClick={onToggleCollapsed}>
          <svg className={`sidebar-group-chevron ${collapsed ? 'collapsed' : ''}`} width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="2,4 6,8 10,4" />
          </svg>
          <span>{title}</span>
          <span className="sidebar-group-count">{count}</span>
        </button>
        <div className="sidebar-sort-wrap">
          <button ref={sortButtonRef} type="button" className={`sidebar-sort-btn ${sortMode !== 'weakest' ? 'active' : ''}`} onClick={onToggleSort} aria-label="Sort">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="2" y1="4" x2="12" y2="4"/><line x1="4" y1="7" x2="10" y2="7"/><line x1="6" y1="10" x2="8" y2="10"/>
            </svg>
          </button>
          {sortOpen && <SortMenu options={SORT_OPTIONS} current={sortMode} anchorRef={sortButtonRef} onSelect={onSelectSort} onClose={onCloseSort} />}
        </div>
      </div>
      {meta && <div className="sidebar-group-meta">{meta}</div>}
      {!collapsed && children}
    </div>
  )
}
