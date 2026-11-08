import {fireEvent, render, screen} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {MemoryRouter} from 'react-router-dom'
import type {MemoryRouterProps} from 'react-router-dom'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {routes} from '@/app/routes'
import {TopicSidebarHeader} from '@/features/topics/components/TopicSidebarHeader'

const navigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {...actual, useNavigate: () => navigate}
})

function renderHeader(initialEntries: MemoryRouterProps['initialEntries'] = ['/?page=2&search=word']) {
  const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}})
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <TopicSidebarHeader
          topicSearch=""
          setTopicSearch={vi.fn()}
          isSmartReview={false}
          onSelectSmartReview={vi.fn()}
          smartQueue={null}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('TopicSidebarHeader quick navigation', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('shows Favorites and My Lexora outside the search container', () => {
    renderHeader()
    const quickLinks = screen.getByRole('navigation', {name: 'Quick navigation'})
    expect(quickLinks.contains(screen.getByRole('button', {name: 'Daily Word Mix'}))).toBe(true)
    expect(quickLinks.contains(screen.getByRole('button', {name: 'Favorites'}))).toBe(true)
    expect(quickLinks.contains(screen.getByRole('button', {name: 'My Lexora'}))).toBe(true)
    expect(quickLinks.closest('.sidebar-search-wrap')).toBeNull()
    expect(screen.getAllByRole('button', {name: 'Favorites'})).toHaveLength(1)
  })

  it('preserves the route and scroll position when opening My Lexora', () => {
    const scrollingList = document.createElement('div')
    scrollingList.className = 'word-collection-scroll'
    scrollingList.scrollTop = 237
    document.body.appendChild(scrollingList)

    try {
      renderHeader()
      fireEvent.click(screen.getByRole('button', {name: 'My Lexora'}))
      expect(navigate).toHaveBeenCalledWith(routes.account, {
        state: expect.objectContaining({
          returnTo: '/?page=2&search=word',
          returnScrollTop: 237,
        }),
      })
    } finally {
      scrollingList.remove()
    }
  })

  it('keeps topic search visible beside the navigation shortcuts', () => {
    renderHeader()
    expect(screen.getByRole('searchbox', {name: 'Search topics'})).toBeTruthy()
    expect(document.activeElement).not.toBe(screen.getByRole('searchbox', {name: 'Search topics'}))
    expect(screen.getByRole('button', {name: 'Favorites'})).toBeTruthy()
    expect(screen.getByRole('button', {name: 'My Lexora'})).toBeTruthy()
  })

  it('returns from the account menu to the saved word list on the second click', () => {
    renderHeader([{pathname: '/account/study', state: {
      returnTo: '/topics/travel?page=2&cefr=A1', returnLanguage: 'en', returnScrollTop: 357,
      returnState: {filtersExpanded: true},
    }}])
    fireEvent.click(screen.getByRole('button', {name: 'My Lexora'}))
    expect(navigate).toHaveBeenCalledWith('/topics/travel?page=2&cefr=A1', {
      state: {filtersExpanded: true, learningLanguage: 'en', wordListScrollTop: 357},
    })
  })
})
