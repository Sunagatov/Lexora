import {fireEvent, render, screen} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

import {ConfirmModal} from '@/shared/ui/ConfirmModal'

describe('ConfirmModal', () => {
  it('disables actions while pending', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()

    render(
      <ConfirmModal
        title="Delete?"
        message="This cannot be undone."
        confirmLabel="Delete"
        danger
        pending
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )

    expect((screen.getByRole('button', {name: 'Cancel'}) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', {name: 'Working…'}) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByText('This cannot be undone.').closest('.modal-overlay') as Element)
    fireEvent.keyDown(document, {key: 'Escape'})

    expect(onConfirm).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('still allows closing when not pending', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()

    render(
      <ConfirmModal
        title="Delete?"
        message="This cannot be undone."
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )

    fireEvent.click(screen.getByText('This cannot be undone.').closest('.modal-overlay') as Element)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
