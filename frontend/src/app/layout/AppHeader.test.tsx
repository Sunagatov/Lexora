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

  it('opens My Lexora without signing out or clearing the vocabulary cache', () => {
    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })
    queryClient.setQueryData(['words'], [{id: 1}])
    const clearSpy = vi.spyOn(queryClient, 'clear')

    renderHeader(queryClient)

    fireEvent.click(screen.getByRole('button', {name: 'My Lexora'}))
    expect(authApi.logout).not.toHaveBeenCalled()
    expect(clearSpy).not.toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith(routes.account, {state: expect.objectContaining({returnTo: '/'})})
    expect(screen.queryByRole('button', {name: 'Sign out'})).toBeNull()
  })

  it('toggles back from an account section to the saved list state', () => {
    const returnTo = '/?search=word&page=2&pageSize=100&level=1&sort=term-desc'
    renderHeader(new QueryClient(), [{pathname: '/account/appearance', state: {
      returnTo, returnLanguage: 'en', returnScrollTop: 320,
      returnState: {fromTopicSlug: 'people'},
    }}])
    fireEvent.click(screen.getByRole('button', {name: 'My Lexora'}))
    expect(navigate).toHaveBeenCalledWith(returnTo, {state: {
      fromTopicSlug: 'people', learningLanguage: 'en', wordListScrollTop: 320,
    }})
  })
})
