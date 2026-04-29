import type {ReactNode} from 'react'

type Props = {
  label: string
  children: ReactNode
}

export function TopicSidebarListSection({label, children}: Props) {
  return (
    <div className="sidebar-group">
      <div className="sidebar-group-header">
        <span className="sidebar-group-label">{label}</span>
      </div>
      {children}
    </div>
  )
}
