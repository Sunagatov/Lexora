import {render, screen, fireEvent} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {MemoryRouter} from 'react-router-dom'
import type {MemoryRouterProps} from 'react-router-dom'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {AppHeader} from '@/app/layout/AppHeader'
import {routes} from '@/app/routes'
import * as authApi from '@/features/auth/api/authApi'

vi.mock('@/features/auth/api/authApi')

const navigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigate,
  }
})

function renderHeader(queryClient: QueryClient, initialEntries?: MemoryRouterProps['initialEntries']) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <AppHeader />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AppHeader personal area', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('opens All words without signing out or clearing the vocabulary cache', () => {
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })
    queryClient.setQueryData(['words'], [{id: 1}])
    const clearSpy = vi.spyOn(queryClient, 'clear')

    renderHeader(queryClient)

    fireEvent.click(screen.getByRole('button', {name: 'Lexora'}))
    expect(authApi.logout).not.toHaveBeenCalled()
    expect(clearSpy).not.toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith(routes.home)
    expect(screen.queryByRole('button', {name: 'Sign out'})).toBeNull()
  })

  it.each(['/words/1', '/account/appearance'])('keeps the account shortcut out of the header on %s', path => {
    renderHeader(new QueryClient(), [path])
    expect(screen.queryByRole('button', {name: 'My Lexora'})).toBeNull()
  })

  it('returns from My Lexora to the captured list including its page and scroll position', () => {
    renderHeader(new QueryClient(), [{pathname: '/account/study', state: {
      returnTo: '/topics/travel?search=train&page=2', returnLanguage: 'en', returnScrollTop: 480,
      returnState: {custom: 'kept'},
    }}])
    fireEvent.click(screen.getByRole('button', {name: 'Lexora'}))
    expect(navigate).toHaveBeenCalledWith('/topics/travel?search=train&page=2', {
      state: {custom: 'kept', learningLanguage: 'en', wordListScrollTop: 480},
    })
  })

  it('uses the hamburger instead of a duplicate account button on study routes', () => {
    const onOpenDrawer = vi.fn()
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/']}>
          <AppHeader hasDrawer onOpenDrawer={onOpenDrawer} />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(screen.queryByRole('button', {name: 'My Lexora'})).toBeNull()
    fireEvent.click(screen.getByRole('button', {name: 'Open sidebar'}))
    expect(onOpenDrawer).toHaveBeenCalledOnce()
  })
})
