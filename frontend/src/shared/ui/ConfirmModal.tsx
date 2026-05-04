import {useEffect} from 'react'
import {createPortal} from 'react-dom'
import {Button} from '@/shared/components/Button'

type Props = {
  title: string
  message: string
  error?: string | null
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  pending?: boolean
  onConfirm: () => void
  onCancel: () => void
  onClose?: () => void
}

export function ConfirmModal({
  title,
  message,
  error = null,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  pending = false,
  onConfirm,
  onCancel,
  onClose,
}: Props) {
  const handleClose = onClose ?? onCancel

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !pending) handleClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [handleClose, pending])

  return createPortal(
    <div className="modal-overlay" onClick={() => { if (!pending) handleClose() }}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{title}</h2>
        <p className="modal-message">{message}</p>
        {error && <p className="login-error" style={{textAlign: 'left'}}>{error}</p>}
        <div className="modal-actions">
          <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={danger ? 'danger' : 'primary'}
            size="sm"
            isLoading={pending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
