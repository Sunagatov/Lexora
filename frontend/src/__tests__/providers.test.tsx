import {render, screen, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import type {PropsWithChildren} from 'react'
import {Providers} from '../providers'
import * as authApi from '../features/auth/api'

vi.mock('../features/auth/api')

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

function renderProviders(children: PropsWithChildren['children']) {
  return render(<Providers>{children}</Providers>)
}

describe('Providers auth bootstrap gating', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeStorage())
    vi.clearAllMocks()
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

  it('renders children immediately when csrf token already exists', () => {
    localStorage.setItem('csrf_token', 'existing-token')

    renderProviders(<Child />)

    expect(screen.getByText('protected app')).toBeTruthy()
    expect(authApi.bootstrapSession).not.toHaveBeenCalled()
  })
})
