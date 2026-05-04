type BreadcrumbItem = {
  label: string
  onClick?: () => void
  isActive?: boolean
}

type BreadcrumbProps = {
  items: BreadcrumbItem[]
}

export function Breadcrumb({items}: BreadcrumbProps) {
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      {items.map((item, idx) => (
        <span key={`${item.label}-${idx}`} className={`breadcrumb-item${item.isActive ? ' is-active' : ''}`}>
          {item.onClick && !item.isActive ? (
            <button type="button" className="breadcrumb-link" onClick={item.onClick}>
              {item.label}
            </button>
          ) : (
            <span>{item.label}</span>
          )}
          {idx < items.length - 1 && <span className="breadcrumb-separator">/</span>}
        </span>
      ))}
    </nav>
  )
}
