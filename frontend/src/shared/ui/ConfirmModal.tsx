import {useEffect} from 'react'
import {createPortal} from 'react-dom'

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
          <button type="button" className="modal-btn-cancel" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`modal-btn-confirm ${danger ? 'modal-btn-danger' : ''}`}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
