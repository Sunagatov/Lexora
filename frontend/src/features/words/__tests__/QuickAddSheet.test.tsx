import {fireEvent, render, screen} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

import {QuickAddSheet} from '@/features/words/components/QuickAddSheet'
import * as quickAddHook from '@/features/words/hooks/useQuickAdd'

vi.mock('@/features/words/hooks/useQuickAdd', () => ({
  useQuickAdd: vi.fn(),
}))

function mockQuickAdd(overrides: Record<string, unknown> = {}) {
  const base = {
    termRef: {current: null},
    term: '',
    setTerm: vi.fn(),
    translation: '',
    setTranslation: vi.fn(),
    topicId: null,
    setTopicId: vi.fn(),
    newTopic: '',
    setNewTopic: vi.fn(),
    addingTopic: false,
    setAddingTopic: vi.fn(),
    enriching: false,
    enrichResult: null,
    enrichDone: false,
    feedback: null,
    topicsLoading: false,
    sortedTopics: [],
    savePending: false,
    createTopicPending: false,
    canSave: true,
    save: vi.fn(),
    enrich: vi.fn(),
    createTopic: vi.fn(),
    cancelNewTopic: vi.fn(),
  }
  return {...base, ...overrides}
}

describe('QuickAddSheet', () => {
  it('keeps background controls inert, closes once on Escape, and restores focus', () => {
    vi.mocked(quickAddHook.useQuickAdd).mockReturnValue(mockQuickAdd() as never)
    const app = document.createElement('div')
    app.className = 'app-shell'
    const opener = document.createElement('button')
    app.append(opener)
    document.body.append(app)
    opener.focus()
    const onClose = vi.fn()
    const {unmount} = render(<QuickAddSheet onClose={onClose} />)
    expect(app.inert).toBe(true)
    expect(screen.getByRole('button', {name: 'Enrich word'})).toBeTruthy()
    expect(screen.getByRole('combobox', {name: 'Topic'})).toBeTruthy()
    fireEvent.keyDown(screen.getByRole('textbox', {name: 'Word or phrase'}), {key: 'Escape'})
    expect(onClose).toHaveBeenCalledOnce()
    unmount()
    expect(app.inert).toBe(false)
    expect(document.activeElement).toBe(opener)
    app.remove()
  })

  it('keeps draft fields locked while a save is pending', () => {
    vi.mocked(quickAddHook.useQuickAdd).mockReturnValue(mockQuickAdd({savePending: true, canSave: false}) as never)
    render(<QuickAddSheet onClose={vi.fn()} />)
    for (const input of screen.getAllByRole('textbox')) expect((input as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByRole('combobox') as HTMLSelectElement).disabled).toBe(true)
    expect((screen.getByRole('button', {name: 'Saving…'}) as HTMLButtonElement).disabled).toBe(true)
  })

  it('does not submit from Enter while save is pending', () => {
    vi.mocked(quickAddHook.useQuickAdd).mockReturnValue(mockQuickAdd({savePending: true, canSave: false}) as never)

    render(<QuickAddSheet onClose={vi.fn()} />)

    const inputs = screen.getAllByRole('textbox')
    fireEvent.keyDown(inputs[0], {key: 'Enter'})
    fireEvent.keyDown(inputs[1], {key: 'Enter'})

    const q = vi.mocked(quickAddHook.useQuickAdd).mock.results[0].value as ReturnType<typeof mockQuickAdd>
    expect(q.save).not.toHaveBeenCalled()
  })

  it('does not create a topic from Enter while topic creation is pending', () => {
    vi.mocked(quickAddHook.useQuickAdd).mockReturnValue(
      mockQuickAdd({addingTopic: true, newTopic: 'Astronomy', createTopicPending: true}) as never,
    )

    render(<QuickAddSheet onClose={vi.fn()} />)

    fireEvent.keyDown(screen.getByPlaceholderText('New topic name…'), {key: 'Enter'})

    const q = vi.mocked(quickAddHook.useQuickAdd).mock.results[0].value as ReturnType<typeof mockQuickAdd>
    expect(q.createTopic).not.toHaveBeenCalled()
  })
})
