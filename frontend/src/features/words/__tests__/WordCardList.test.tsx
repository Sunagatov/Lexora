import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {act, fireEvent, render, screen} from '@testing-library/react'
import {createMemoryRouter, RouterProvider} from 'react-router-dom'
import {describe, expect, it, vi} from 'vitest'
import {WordCardList} from '@/features/words/components/WordCardList'
import type {Word} from '@/features/words/types/wordTypes'
import {deleteWord} from '@/features/words/api/wordsApi'
import {queryKeys} from '@/app/queryKeys'

vi.mock('@/features/words/api/wordsApi', async importOriginal => ({
  ...await importOriginal<typeof import('@/features/words/api/wordsApi')>(), deleteWord: vi.fn(),
}))

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
  it('edits from the word menu while preserving the current list context', () => {
    const router = createMemoryRouter([
      {path: '/', element: <WordCardList words={[makeWord(1, 'hola')]} pendingWordId={null} onUpdate={vi.fn()} />},
      {path: '/words/1/edit', element: <div>Editor</div>},
    ], {initialEntries: ['/?search=hola&page=2']})
    render(<QueryClientProvider client={new QueryClient()}><RouterProvider router={router} /></QueryClientProvider>)
    const actions = screen.getByRole('button', {name: 'Actions for hola'})
    fireEvent.click(actions)
    fireEvent.click(screen.getByRole('button', {name: 'Close word actions'}))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(actions)
    fireEvent.click(actions)
    fireEvent.click(screen.getByRole('link', {name: 'Edit word & topics'}))
    expect(router.state.location.pathname).toBe('/words/1/edit')
    expect(router.state.location.state.returnTo).toMatchObject({pathname: '/', search: '?search=hola&page=2'})
  })

  it('requires confirmation before moving a word to Trash and preserves it after a failed request', async () => {
    vi.mocked(deleteWord).mockRejectedValueOnce(new Error('Network down'))
    const client = new QueryClient({defaultOptions: {mutations: {retry: false}}})
    const word = makeWord(1, 'hola')
    client.setQueryData(queryKeys.publicConfig, {trash_retention_days: 45})
    client.setQueryData(queryKeys.words, [word])
    const router = createMemoryRouter([{path: '/', element: <WordCardList words={[word]} pendingWordId={null} onUpdate={vi.fn()} />}])
    render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>)
    fireEvent.click(screen.getByRole('button', {name: 'Actions for hola'}))
    fireEvent.click(screen.getByRole('button', {name: 'Move to Trash'}))
    expect(deleteWord).not.toHaveBeenCalled()
    expect(screen.getByText(/45 days/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', {name: 'Move to Trash'}))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(client.getQueryData(queryKeys.words)).toEqual([word])
    expect(router.state.location.pathname).toBe('/')
  })

  it('removes a trashed word from the cached list after a successful confirmed request', async () => {
    vi.mocked(deleteWord).mockResolvedValueOnce(undefined)
    const client = new QueryClient()
    const word = makeWord(1, 'hola')
    client.setQueryData(queryKeys.publicConfig, {trash_retention_days: 30})
    client.setQueryData(queryKeys.words, [word])
    const router = createMemoryRouter([{path: '/', element: <WordCardList words={[word]} pendingWordId={null} onUpdate={vi.fn()} />}])
    render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>)
    fireEvent.click(screen.getByRole('button', {name: 'Actions for hola'}))
    fireEvent.click(screen.getByRole('button', {name: 'Move to Trash'}))
    await act(async () => { fireEvent.click(screen.getByRole('button', {name: 'Move to Trash'})) })
    expect(client.getQueryData(queryKeys.words)).toEqual([])
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('keeps pronunciation with the term in the word link and audio outside it', () => {
    const router = createMemoryRouter([{path: '/', element: <WordCardList words={[makeWord(1, 'hola', {language: 'es', pronunciation_easy: 'о́ла'})]} pendingWordId={null} onUpdate={vi.fn()} />}])
    const {container} = render(<QueryClientProvider client={new QueryClient()}><RouterProvider router={router} /></QueryClientProvider>)
    const hint = container.querySelector('.word-easy-pronunciation')!
    expect(hint.textContent).toBe('о́ла')
    expect(hint.closest('a')?.className).toBe('word-card-body-tap')
    expect(hint.previousElementSibling?.textContent).toBe('hola')
    const speaker = screen.getByRole('button', {name: 'Pronounce hola'})
    expect(speaker.closest('a')).toBeNull()
    expect(speaker.parentElement?.className).toBe('word-card-actions')
    expect(container.querySelector('a button')).toBeNull()
  })

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
    vi.spyOn(window, 'matchMedia').mockReturnValue({matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn()} as unknown as MediaQueryList)
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
  it('shows all translations without an expand button or changing the rating', () => {
    const translations = ['холодный', 'прохладный', 'остывший', 'неприветливый']
    const onUpdate = vi.fn()
    const router = createMemoryRouter([{
      path: '/',
      element: <WordCardList words={[makeWord(1, 'cold', {translation_entries: translations}), makeWord(2, 'warm')]} pendingWordId={null} onUpdate={onUpdate} />,
    }])

    render(<QueryClientProvider client={new QueryClient()}><RouterProvider router={router} /></QueryClientProvider>)

    expect(screen.getByText(translations.join(' · '))).toBeTruthy()
    expect(screen.queryByRole('button', {name: /Expand translations/})).toBeNull()
    expect(router.state.location.pathname).toBe('/')
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('shows a single long translation in full without an expander', () => {
    const router = createMemoryRouter([{path: '/', element: <WordCardList words={[
      makeWord(1, 'long', {translation_entries: ['Один длинный перевод, который не помещается на одной строке карточки.']}),
      makeWord(2, 'empty', {translation_entries: []}),
    ]} pendingWordId={null} onUpdate={vi.fn()} />}])
    render(<QueryClientProvider client={new QueryClient()}><RouterProvider router={router} /></QueryClientProvider>)
    expect(screen.getByText('Один длинный перевод, который не помещается на одной строке карточки.')).toBeTruthy()
    expect(screen.queryByRole('button', {name: 'Expand translations for long'})).toBeNull()
    expect(screen.queryByRole('button', {name: 'Expand translations for empty'})).toBeNull()
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

    fireEvent.click(screen.getByRole('button', {name: 'Close knowledge selector'}))

    expect(screen.getByText('alpha')).toBeTruthy()
    expect(screen.queryByText('word detail page')).toBeNull()
    expect(screen.queryByRole('dialog', {name: 'Knowledge level'})).toBeNull()
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
