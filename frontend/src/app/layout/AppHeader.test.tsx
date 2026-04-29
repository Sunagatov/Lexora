import {render, screen, fireEvent, waitFor} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {MemoryRouter} from 'react-router-dom'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {AppHeader} from '@/app/layout/AppHeader'
import {DrawerProvider} from '@/app/layout/DrawerContext'
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

function renderHeader(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DrawerProvider>
          <AppHeader />
        </DrawerProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AppHeader logout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls logout, clears cached data, and navigates to login', async () => {
    vi.mocked(authApi.logout).mockResolvedValue(undefined)

    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })
    queryClient.setQueryData(['words'], [{id: 1}])
    const clearSpy = vi.spyOn(queryClient, 'clear')

    renderHeader(queryClient)

    fireEvent.click(screen.getByRole('button', {name: 'Sign out'}))

    await waitFor(() => {
      expect(authApi.logout).toHaveBeenCalledTimes(1)
    })
    expect(clearSpy).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith(routes.login, {replace: true})
  })
})
