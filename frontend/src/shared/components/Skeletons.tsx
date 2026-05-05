export function SkeletonTable({rows = 5}: {rows?: number}) {
  return (
    <div className="sk-table-rows">
      {Array.from({length: rows}, (_, i) => (
        <div key={i} className="sk-table-row">
          <div className="sk sk-text medium" />
          <div className="sk sk-text" />
          <div className="sk sk-text short" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonCardGrid({count = 4}: {count?: number}) {
  return (
    <div className="sk-card-grid">
      {Array.from({length: count}, (_, i) => (
        <div key={i} className="sk-card-item">
          <div className="sk sk-heading" />
          <div className="sk sk-text" />
          <div className="sk sk-text medium" />
          <div className="sk sk-text short" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonHero() {
  return (
    <div className="sk-hero">
      <div className="sk sk-hero-title" />
      <div className="sk-hero-content">
        {[0, 1, 2, 3].map((i) => <div key={i} className="sk sk-hero-card" />)}
      </div>
    </div>
  )
}

export function SkeletonList({count = 4}: {count?: number}) {
  return (
    <div className="sk-list">
      {Array.from({length: count}, (_, i) => (
        <div key={i} className="sk-list-item">
          <div className="sk sk-avatar" />
          <div className="sk-list-item-content">
            <div className="sk sk-text medium" />
            <div className="sk sk-text short" />
          </div>
        </div>
      ))}
    </div>
  )
}
