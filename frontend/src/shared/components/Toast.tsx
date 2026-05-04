import {useEffect, useState} from 'react'

type ToastProps = {
  message: string
  type: 'success' | 'error' | 'info'
  duration?: number
  onClose: () => void
}

export function Toast({message, type, duration = 3000, onClose}: ToastProps) {
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsClosing(true)
      window.setTimeout(onClose, 250)
    }, duration)

    return () => window.clearTimeout(timer)
  }, [duration, onClose])

  return (
    <div className={`toast is-${type} ${isClosing ? 'is-closing' : ''}`} role="status" aria-live="polite">
      <div className="toast-content">
        {type === 'success' && <span className="toast-icon" aria-hidden="true">✓</span>}
        {type === 'error' && <span className="toast-icon" aria-hidden="true">✕</span>}
        <span>{message}</span>
      </div>
    </div>
  )
}
