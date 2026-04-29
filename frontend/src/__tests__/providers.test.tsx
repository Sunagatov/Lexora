import {render, screen, waitFor} from '@testing-library/react'
import {fireEvent} from '@testing-library/react'
import {useMutation} from '@tanstack/react-query'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import type {PropsWithChildren} from 'react'
import {Providers} from '@/app/providers'
import {routes} from '@/app/routes'
import * as authApi from '@/features/auth/api/authApi'
import {ApiError} from '@/shared/api/apiError'

vi.mock('@/features/auth/api/authApi')
vi.mock('@/features/auth/lib/redirectIfUnauthorized', () => ({
  redirectIfUnauthorized: vi.fn(),
}))

import {redirectIfUnauthorized} from '@/features/auth/lib/redirectIfUnauthorized'

function makeStorage() {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.get(key) ?? null
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
    removeItem(key: string) {
      store.delete(key)
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
  } as Storage
}

function Child() {
  return <div>protected app</div>
}

function MutationChild() {
  const mutation = useMutation({
    mutationFn: async () => {
      throw new ApiError(401, 'Not authenticated')
    },
    onError: () => {
      // Keep a local handler to prove auth redirect still runs globally.
    },
  })

  return (
    <button type="button" onClick={() => mutation.mutate()}>
      fail mutation
    </button>
  )
}

function renderProviders(children: PropsWithChildren['children']) {
  return render(<Providers>{children}</Providers>)
}

describe('Providers auth bootstrap gating', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeStorage())
    vi.clearAllMocks()
    vi.mocked(authApi.bootstrapSession).mockResolvedValue(true)
    window.history.replaceState({}, '', routes.smartReview)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('waits for bootstrapSession before rendering children when csrf token is missing', async () => {
    const bootstrapControl: {resolve: ((value: boolean) => void) | null} = {resolve: null}
    vi.mocked(authApi.bootstrapSession).mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          bootstrapControl.resolve = resolve
        }),
    )

    renderProviders(<Child />)

    expect(screen.queryByText('protected app')).toBeNull()
    expect(authApi.bootstrapSession).toHaveBeenCalledTimes(1)

    expect(bootstrapControl.resolve).toBeTypeOf('function')
    bootstrapControl.resolve?.(true)

    await waitFor(() => {
      expect(screen.getByText('protected app')).toBeTruthy()
    })
  })

  it('still validates the backend session before rendering when csrf token already exists', async () => {
    localStorage.setItem('csrf_token', 'existing-token')
    const bootstrapControl: {resolve: ((value: boolean) => void) | null} = {resolve: null}
    vi.mocked(authApi.bootstrapSession).mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          bootstrapControl.resolve = resolve
        }),
    )

    renderProviders(<Child />)

    expect(screen.queryByText('protected app')).toBeNull()
    expect(authApi.bootstrapSession).toHaveBeenCalledTimes(1)

    bootstrapControl.resolve?.(true)

    await waitFor(() => {
      expect(screen.getByText('protected app')).toBeTruthy()
    })
  })

  it('redirects unauthorized mutation failures even when the mutation defines a local onError handler', async () => {
    localStorage.setItem('csrf_token', 'existing-token')

    renderProviders(<MutationChild />)

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'fail mutation'})).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', {name: 'fail mutation'}))

    await waitFor(() => {
      expect(redirectIfUnauthorized).toHaveBeenCalledWith(expect.objectContaining({status: 401}))
    })
  })

  it('redirects to login when bootstrapSession reports an expired backend session', async () => {
    localStorage.setItem('csrf_token', 'stale-token')
    vi.mocked(authApi.bootstrapSession).mockResolvedValue(false)

    renderProviders(<Child />)

    await waitFor(() => {
      expect(window.location.pathname).toBe(routes.login)
    })
  })
})
