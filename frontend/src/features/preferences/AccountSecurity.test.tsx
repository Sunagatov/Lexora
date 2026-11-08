import {fireEvent, render, screen} from '@testing-library/react'
import {afterEach, expect, it, vi} from 'vitest'
import {AccountSecurity} from './AccountSecurity'

afterEach(() => vi.restoreAllMocks())

it('requires confirmation and prevents repeat clicks while signing out', () => {
  const onLogoutAll = vi.fn().mockResolvedValue(undefined)
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  const {rerender} = render(<AccountSecurity pending={false} onLogoutAll={onLogoutAll} />)
  fireEvent.click(screen.getByRole('button', {name: 'Sign out all devices'}))
  expect(onLogoutAll).not.toHaveBeenCalled()
  confirm.mockReturnValue(true)
  fireEvent.click(screen.getByRole('button', {name: 'Sign out all devices'}))
  expect(onLogoutAll).toHaveBeenCalledOnce()
  rerender(<AccountSecurity pending onLogoutAll={onLogoutAll} />)
  expect(screen.getByRole('button', {name: 'Signing out…'}).hasAttribute('disabled')).toBe(true)
})
