import {act, fireEvent, render, screen} from '@testing-library/react'
import {MemoryRouter} from 'react-router-dom'
import {afterEach, expect, it, vi} from 'vitest'
import {ApiError} from '@/shared/api/apiError'
import {login} from '@/features/auth/api/authApi'
import {LoginPage} from './LoginPage'

vi.mock('@/features/auth/api/authApi', () => ({login: vi.fn()}))
vi.mock('@/features/preferences/api', () => ({loadPreferences: vi.fn()}))
const platform = vi.hoisted(() => ({isIOSApp: false}))
vi.mock('@/shared/platform', () => ({get isIOSApp() { return platform.isIOSApp }}))

afterEach(() => {
  platform.isIOSApp = false
  vi.unstubAllGlobals()
})

it('waits for a tap before focusing the password on iOS', () => {
  platform.isIOSApp = true
  render(<MemoryRouter><LoginPage /></MemoryRouter>)
  expect(document.activeElement).not.toBe(screen.getByLabelText('Password'))
})

it('fits the whole sign-in form into the viewport as the software keyboard resizes it', () => {
  const viewport = Object.assign(new EventTarget(), {height: 800, offsetTop: 0, scale: 1})
  vi.stubGlobal('visualViewport', viewport)
  render(<MemoryRouter><LoginPage /></MemoryRouter>)
  const page = screen.getByRole('button', {name: 'Sign in'}).closest<HTMLElement>('.login-page')!
  expect(page.style.getPropertyValue('--visual-viewport-height')).toBe('800px')

  act(() => {
    viewport.height = 360
    viewport.dispatchEvent(new Event('resize'))
  })
  expect(page.style.getPropertyValue('--visual-viewport-height')).toBe('360px')

  act(() => {
    viewport.offsetTop = 180
    viewport.dispatchEvent(new Event('scroll'))
  })
  expect(page.style.getPropertyValue('--visual-viewport-top')).toBe('180px')

  act(() => {
    viewport.height = 800
    viewport.offsetTop = 0
    viewport.dispatchEvent(new Event('resize'))
  })
  expect(page.style.getPropertyValue('--visual-viewport-height')).toBe('800px')
  expect(page.style.getPropertyValue('--visual-viewport-top')).toBe('0px')
})

it('explains the login cooldown instead of reporting a generic failure', async () => {
  vi.mocked(login).mockRejectedValueOnce(new ApiError(429, 'Try again in 45 seconds.'))
  render(<MemoryRouter><LoginPage /></MemoryRouter>)
  fireEvent.change(screen.getByLabelText('Password'), {target: {value: 'test-password'}})
  fireEvent.click(screen.getByRole('button', {name: 'Sign in'}))
  expect((await screen.findByRole('alert')).textContent).toBe('Try again in 45 seconds.')
})
