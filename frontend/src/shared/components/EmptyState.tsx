import {Button} from '@/shared/components/Button'

type EmptyStateAction = {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'tertiary'
  icon?: string
}

type EmptyStateProps = {
  icon: string
  title: string
  description: string
  actions?: EmptyStateAction[]
  variant?: 'default' | 'error' | 'info' | 'success'
}

export function EmptyState({
  icon,
  title,
  description,
  actions,
  variant = 'default',
}: EmptyStateProps) {
  return (
    <div className={`empty-state${variant !== 'default' ? ` is-${variant}` : ''}`}>
      <div className="empty-state-icon scroll-hint" aria-hidden="true">{icon}</div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{description}</p>
      {actions && actions.length > 0 && (
        <div className="empty-state-actions">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant={action.variant === 'secondary' ? 'secondary' : action.variant === 'tertiary' ? 'tertiary' : 'primary'}
              onClick={action.onClick}
              icon={action.icon ? <span aria-hidden="true">{action.icon}</span> : undefined}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
