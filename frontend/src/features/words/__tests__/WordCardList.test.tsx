import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {act, fireEvent, render, screen} from '@testing-library/react'
import {createMemoryRouter, RouterProvider} from 'react-router-dom'
import {describe, expect, it, vi} from 'vitest'
import {WordCardList} from '@/features/words/components/WordCardList'
import type {Word} from '@/features/words/types/wordTypes'

function makeWord(id: number, term: string, overrides: Partial<Word> = {}): Word {
  return {
    id,
    topic_ids: [],
    term,
    language: 'en',
    definition: null,
    pronunciation_ipa: null,
    pronunciation_audio_url: null,
    image_url: null,
    cefr_level: null,
    register: null,
    frequency_rank: null,
    verb_form: null,
    translation_entries: ['translation'],
    part_of_speech: null,
    knowledge_level: 3,
    countability: null,
    pattern: null,
    example_entries: [],
    example_count: 0,
    example_target_count: 3,
    example_status: 'missing',
    needs_example_enrichment: false,
    synonym_entries: [],
    antonym_entries: [],
    collocation_entries: [],
    confusable_entries: [],
    notes: null,
    is_active: true,
    deleted_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function swipeCard(card: HTMLElement, end = 195) {
  card.setPointerCapture = vi.fn()
  for (const [type, x] of [['pointerdown', 100], ['pointermove', end], ['pointerup', end]] as const) {
    const event = new Event(type, {bubbles: true})
    Object.assign(event, {pointerType: 'touch', pointerId: 1, isPrimary: true, clientX: x, clientY: 100})
    fireEvent(card, event)
  }
}

describe('WordCardList', () => {
  it('saves overlapping swipes in either direction without showing an Undo popup', async () => {
    let finishFirst!: (value: boolean) => void, finishSecond!: (value: boolean) => void
    const onUpdate = vi.fn()
      .mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve }))
      .mockImplementationOnce(() => new Promise(resolve => { finishSecond = resolve }))
    const router = createMemoryRouter([{path: '/', element: <WordCardList words={[makeWord(1, 'patient'), makeWord(2, 'calm')]} pendingWordId={null} onUpdate={onUpdate} />}])
    render(<QueryClientProvider client={new QueryClient()}><RouterProvider router={router} /></QueryClientProvider>)
    const cards = document.querySelectorAll('article')
    act(() => { swipeCard(cards[0]); swipeCard(cards[1], 25) })
    await act(async () => { finishSecond(true) })
    expect(screen.queryByRole('status')).toBeNull()
    await act(async () => { finishFirst(true) })
    expect(onUpdate.mock.calls).toEqual([[1, 4], [2, 5]])
    expect(screen.queryByRole('button', {name: 'Undo'})).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })
  it('does not claim a failed swipe was saved or offer Undo for it', async () => {
    const onUpdate = vi.fn().mockResolvedValue(false)
    const router = createMemoryRouter([{path: '/', element: <WordCardList words={[makeWord(1, 'patient')]} pendingWordId={null} onUpdate={onUpdate} />}])
    render(<QueryClientProvider client={new QueryClient()}><RouterProvider router={router} /></QueryClientProvider>)
    const card = document.querySelector('article')!
    card.setPointerCapture = vi.fn()
    await act(async () => {
      for (const [type, x] of [['pointerdown', 100], ['pointermove', 195], ['pointerup', 195]] as const) {
        const event = new Event(type, {bubbles: true})
        Object.assign(event, {pointerType: 'touch', pointerId: 1, isPrimary: true, clientX: x, clientY: 100})
        fireEvent(card, event)
      }
    })
    expect(onUpdate).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', {name: 'Undo'})).toBeNull()
  })
  it('saves a touch swipe without opening the word detail route or showing Undo', async () => {
    window.matchMedia = vi.fn().mockReturnValue({matches: true})
    const onUpdate = vi.fn()
    const router = createMemoryRouter([{path: '/', element: <WordCardList words={[makeWord(1, 'patient')]} pendingWordId={null} onUpdate={onUpdate} />}])
    render(<QueryClientProvider client={new QueryClient()}><RouterProvider router={router} /></QueryClientProvider>)
    const card = document.querySelector('article')!
    card.setPointerCapture = vi.fn()
    for (const [type, x] of [['pointerdown', 100], ['pointermove', 195], ['pointerup', 195]] as const) {
      const event = new Event(type, {bubbles: true})
      Object.assign(event, {pointerType: 'touch', pointerId: 1, isPrimary: true, clientX: x, clientY: 100})
      fireEvent(card, event)
      if (type === 'pointermove') {
        expect(card.style.getPropertyValue('--swipe-x')).toBe('95px')
        expect(card.classList.contains('swipe-dragging')).toBe(true)
      }
    }
    await act(async () => {})
    expect(onUpdate).toHaveBeenCalledExactlyOnceWith(1, 4)
    expect(card.style.getPropertyValue('--swipe-x')).toBe('0px')
    expect(router.state.location.pathname).toBe('/')
    expect(screen.queryByRole('button', {name: 'Undo'})).toBeNull()
  })
  it('shows every saved translation in the mobile word list', () => {
    const translations = ['холодный', 'прохладный', 'остывший', 'неприветливый']
    const router = createMemoryRouter([{
      path: '/',
      element: <WordCardList words={[makeWord(1, 'cold', {translation_entries: translations})]} pendingWordId={null} onUpdate={vi.fn()} />,
    }])

    render(<QueryClientProvider client={new QueryClient()}><RouterProvider router={router} /></QueryClientProvider>)

    expect(screen.getByText(translations.join(' · '))).toBeTruthy()
  })

  it('closes the level dropdown without navigating to the word page', () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: (
            <WordCardList
              words={[makeWord(1, 'alpha')]}
              pendingWordId={null}
              onUpdate={vi.fn()}
            />
          ),
        },
        {path: '/words/:wordId', element: <div>word detail page</div>},
      ],
      {initialEntries: ['/']},
    )

    render(<QueryClientProvider client={new QueryClient()}><RouterProvider router={router} /></QueryClientProvider>)

    fireEvent.click(screen.getByRole('button', {name: /okay/i}))

    const overlay = document.querySelector('.level-dropdown-overlay')
    expect(overlay).not.toBeNull()

    fireEvent.click(overlay!)

    expect(screen.getByText('alpha')).toBeTruthy()
    expect(screen.queryByText('word detail page')).toBeNull()
    expect(document.querySelector('.level-dropdown-overlay')).toBeNull()
  })
})


it('does not promise Release for a diagonal drag that will not save', async () => {
  const onUpdate = vi.fn()
  const router = createMemoryRouter([{path: '/', element: <WordCardList words={[makeWord(1, 'patient')]} pendingWordId={null} onUpdate={onUpdate} />}])
  render(<QueryClientProvider client={new QueryClient()}><RouterProvider router={router} /></QueryClientProvider>)
  const card = document.querySelector('article')!
  card.setPointerCapture = vi.fn()
  for (const [type, x, y] of [['pointerdown', 100, 100], ['pointermove', 120, 102], ['pointermove', 195, 180]] as const) {
    const event = new Event(type, {bubbles: true})
    Object.assign(event, {pointerType: 'touch', pointerId: 1, isPrimary: true, clientX: x, clientY: y})
    fireEvent(card, event)
  }
  expect(screen.queryByText(/Release/)).toBeNull()
  const event = new Event('pointerup', {bubbles: true})
  Object.assign(event, {pointerType: 'touch', pointerId: 1, isPrimary: true, clientX: 195, clientY: 180})
  await act(async () => { fireEvent(card, event) })
  expect(onUpdate).not.toHaveBeenCalled()
})


it('blocks swipes on each pending word while other cards remain usable', async () => {
  const onUpdate = vi.fn()
  const router = createMemoryRouter([{path: '/', element: <WordCardList words={[makeWord(1, 'patient'), makeWord(2, 'calm')]} pendingWordId={null} pendingWordIds={new Set([1])} onUpdate={onUpdate} />}])
  render(<QueryClientProvider client={new QueryClient()}><RouterProvider router={router} /></QueryClientProvider>)
  const cards = document.querySelectorAll('article')
  await act(async () => { swipeCard(cards[0]); swipeCard(cards[1], 25) })
  expect(onUpdate).toHaveBeenCalledExactlyOnceWith(2, 5)
})

it('does not save again when swiping to the current knowledge level', async () => {
  const onUpdate = vi.fn()
  const router = createMemoryRouter([{path: '/', element: <WordCardList words={[makeWord(1, 'patient', {knowledge_level: 4})]} pendingWordId={null} onUpdate={onUpdate} />}])
  render(<QueryClientProvider client={new QueryClient()}><RouterProvider router={router} /></QueryClientProvider>)
  await act(async () => { swipeCard(document.querySelector('article')!) })
  expect(onUpdate).not.toHaveBeenCalled()
})
