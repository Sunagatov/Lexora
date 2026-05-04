import type {ButtonHTMLAttributes, ReactNode} from 'react'

type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'danger' | 'success' | 'icon'
  size?: 'sm' | 'md' | 'lg'
  block?: boolean
  isLoading?: boolean
  icon?: ReactNode
  children?: ReactNode
  className?: string
} & ButtonHTMLAttributes<HTMLButtonElement>

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  isLoading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const sizeClass = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : ''
  const classes = [
    'btn',
    `btn-${variant}`,
    sizeClass,
    block ? 'btn-block' : '',
    isLoading ? 'is-loading' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <button className={classes} disabled={disabled || isLoading} {...props}>
      {icon}
      {children}
    </button>
  )
}
