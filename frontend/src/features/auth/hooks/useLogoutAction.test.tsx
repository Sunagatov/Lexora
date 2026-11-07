import {act, renderHook} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {MemoryRouter} from 'react-router-dom'
import type {PropsWithChildren} from 'react'
import {beforeEach, expect, it, vi} from 'vitest'
import {logout, logoutAll} from '@/features/auth/api/authApi'
import {useLogoutAction} from './useLogoutAction'

vi.mock('@/features/auth/api/authApi', () => ({logout: vi.fn(), logoutAll: vi.fn()}))
beforeEach(() => { vi.mocked(logout).mockReset(); vi.mocked(logoutAll).mockReset() })

function setup() {
  const client = new QueryClient()
  client.setQueryData(['saved-library'], ['keep this until logout succeeds'])
  function Wrapper({children}: PropsWithChildren) {
    return <QueryClientProvider client={client}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
  }
  return {...renderHook(() => useLogoutAction(), {wrapper: Wrapper}), client}
}

it('shows a recoverable sign-out error and only clears data after a successful retry', async () => {
  const {result, client} = setup()
  vi.mocked(logout).mockRejectedValueOnce(new Error('Service unavailable'))
  await act(async () => { await result.current.handleLogout() })
  expect(result.current.logoutError).toContain('Service unavailable')
  expect(result.current.logoutPending).toBe(false)
  expect(client.getQueryData(['saved-library'])).toBeDefined()
  vi.mocked(logout).mockResolvedValueOnce(true)
  await act(async () => { await result.current.handleLogout() })
  expect(result.current.logoutError).toBe('')
  expect(client.getQueryData(['saved-library'])).toBeUndefined()
})

it('keeps the session and avoids an error message when sign-out is cancelled', async () => {
  const {result, client} = setup()
  vi.mocked(logout).mockResolvedValueOnce(false)
  await act(async () => { await result.current.handleLogout() })
  expect(result.current.logoutError).toBe('')
  expect(client.getQueryData(['saved-library'])).toBeDefined()
})

it('clears local queries only after all-device revocation succeeds', async () => {
  const {result, client} = setup()
  vi.mocked(logoutAll).mockRejectedValueOnce(new Error('Service unavailable'))
  await act(async () => { await result.current.handleLogoutAll() })
  expect(client.getQueryData(['saved-library'])).toBeDefined()
  expect(result.current.logoutError).toContain('Service unavailable')
  vi.mocked(logoutAll).mockResolvedValueOnce(true)
  await act(async () => { await result.current.handleLogoutAll() })
  expect(client.getQueryData(['saved-library'])).toBeUndefined()
  expect(logout).not.toHaveBeenCalled()
})
