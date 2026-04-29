import {render, screen} from '@testing-library/react'
import {MemoryRouter, Route, Routes} from 'react-router-dom'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {describe, it, expect, vi, beforeEach} from 'vitest'
import {WordPage} from '@/features/words/routes/WordPage'
import * as wordsApi from '@/features/words/api/wordsApi'
import * as topicsApi from '@/features/topics/api/topicsApi'

vi.mock('@/features/words/api/wordsApi', () => ({
  fetchWord: vi.fn(),
  fetchWords: vi.fn(),
  updateWord: vi.fn(),
  deleteWord: vi.fn(),
  updateWordKnowledgeLevel: vi.fn(),
  quickAddWord: vi.fn(),
  restoreWord: vi.fn(),
  fetchTrashWords: vi.fn(),
}))

vi.mock('@/features/topics/api/topicsApi', () => ({
  fetchTopics: vi.fn(),
  createTopic: vi.fn(),
  deleteTopic: vi.fn(),
  restoreTopic: vi.fn(),
  fetchTrashTopics: vi.fn(),
}))

function renderWordRoute(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {retry: false},
      mutations: {retry: false},
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/words/:wordId" element={<WordPage />} />
          <Route path="/words/:wordId/edit" element={<WordPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('WordPage invalid route handling', () => {
  beforeEach(() => {
    vi.mocked(wordsApi.fetchWord).mockReset()
    vi.mocked(wordsApi.fetchWords).mockReset()
    vi.mocked(topicsApi.fetchTopics).mockReset()
  })

  it('renders NotFoundPage for /words/foo and does not call fetchWord', () => {
    renderWordRoute('/words/foo')

    expect(screen.getByText('404 — Page not found')).toBeTruthy()
    expect(wordsApi.fetchWord).not.toHaveBeenCalled()
    expect(wordsApi.fetchWords).not.toHaveBeenCalled()
    expect(topicsApi.fetchTopics).not.toHaveBeenCalled()
  })

  it('renders NotFoundPage for /words/0 and does not call fetchWord', () => {
    renderWordRoute('/words/0')

    expect(screen.getByText('404 — Page not found')).toBeTruthy()
    expect(wordsApi.fetchWord).not.toHaveBeenCalled()
    expect(wordsApi.fetchWords).not.toHaveBeenCalled()
    expect(topicsApi.fetchTopics).not.toHaveBeenCalled()
  })

  it('renders NotFoundPage for /words/-1/edit and does not call fetchWord', () => {
    renderWordRoute('/words/-1/edit')

    expect(screen.getByText('404 — Page not found')).toBeTruthy()
    expect(wordsApi.fetchWord).not.toHaveBeenCalled()
    expect(wordsApi.fetchWords).not.toHaveBeenCalled()
    expect(topicsApi.fetchTopics).not.toHaveBeenCalled()
  })
})
