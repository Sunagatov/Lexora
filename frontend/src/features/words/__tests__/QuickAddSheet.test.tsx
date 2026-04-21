import {fireEvent, render, screen} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

import {QuickAddSheet} from '../QuickAddSheet'
import * as quickAddHook from '../useQuickAdd'

vi.mock('../useQuickAdd', () => ({
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
    translating: false,
    suggesting: false,
    aiSuggested: false,
    feedback: null,
    topicsLoading: false,
    sortedTopics: [],
    savePending: false,
    createTopicPending: false,
    canSave: true,
    save: vi.fn(),
    translateOnly: vi.fn(),
    suggestOnly: vi.fn(),
    autoFill: vi.fn(),
    createTopic: vi.fn(),
    cancelNewTopic: vi.fn(),
  }
  return {...base, ...overrides}
}

describe('QuickAddSheet', () => {
  it('does not submit from Enter while save is pending', () => {
    vi.mocked(quickAddHook.useQuickAdd).mockReturnValue(mockQuickAdd({savePending: true, canSave: false}) as never)

    render(<QuickAddSheet onClose={vi.fn()} />)

    fireEvent.keyDown(screen.getByPlaceholderText('e.g. ephemeral'), {key: 'Enter'})
    fireEvent.keyDown(screen.getByPlaceholderText('e.g. недолговечный'), {key: 'Enter'})

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
