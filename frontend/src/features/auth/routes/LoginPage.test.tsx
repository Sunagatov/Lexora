import {fireEvent, render, screen} from '@testing-library/react'
import {MemoryRouter} from 'react-router-dom'
import {expect, it, vi} from 'vitest'
import {ApiError} from '@/shared/api/apiError'
import {login} from '@/features/auth/api/authApi'
import {LoginPage} from './LoginPage'

vi.mock('@/features/auth/api/authApi', () => ({login: vi.fn()}))
vi.mock('@/features/preferences/api', () => ({loadPreferences: vi.fn()}))

it('explains the login cooldown instead of reporting a generic failure', async () => {
  vi.mocked(login).mockRejectedValueOnce(new ApiError(429, 'Try again in 45 seconds.'))
  render(<MemoryRouter><LoginPage /></MemoryRouter>)
  fireEvent.change(screen.getByLabelText('Password'), {target: {value: 'test-password'}})
  fireEvent.click(screen.getByRole('button', {name: 'Sign in'}))
  expect((await screen.findByRole('alert')).textContent).toBe('Try again in 45 seconds.')
})
