import {fireEvent, render, screen, waitFor} from '@testing-library/react'
import {MemoryRouter} from 'react-router-dom'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {SwipeReview} from '../components/SwipeReview'
import type {StudyQueue} from '../types/studyQueueTypes'
import type {Word} from '@/features/words/types/wordTypes'
import {loadSwipeSession, saveSwipeSession, swipeAction, swipeStorageKey} from '../model/swipeSession'
import {useWordUpdate} from '@/features/words/hooks/useWordUpdate'
import {useSmartReview} from '../hooks/useSmartReview'
const visibility = vi.hoisted(() => ({translations: true}))
vi.mock('@/features/preferences/api', async importOriginal => {
  const actual = await importOriginal<typeof import('@/features/preferences/api')>()
  return {...actual, usePreferences: () => ({...actual.preferencesSnapshot().values, translations: visibility.translations})}
})

vi.mock('@/features/words/hooks/useWordUpdate')
vi.mock('../hooks/useSmartReview')

const update = vi.fn()
const complete = vi.fn()
const queue = (language = 'en'): StudyQueue => ({id: 7, generated_at: '2026-11-06T10:00:00Z', expires_at: '2026-11-07T10:00:00Z', is_active: true, total_count: 2, completed_count: 0,
  items: ['resilient', 'adapt'].map((term, i) => ({id: 101 + i, word_id: i + 1, position: i,
    is_completed: false, completed_at: null, word: {id: i + 1, term, language, part_of_speech: 'adjective', cefr_level: 'B2', knowledge_level: 1,
      translation_entries: ['стойкий', 'устойчивый'], example_entries: ['She stayed resilient.'], topic_ids: [],
      pronunciation_ipa: null, pronunciation_easy: null} as unknown as Word}))})

function open(q = queue()) {
  return render(<SwipeReview queue={q} onBackToList={vi.fn()} onBusyChange={vi.fn()} />, {wrapper: MemoryRouter})
}

beforeEach(() => {
  visibility.translations = true
  vi.clearAllMocks()
  update.mockResolvedValue({})
  complete.mockResolvedValue({})
  vi.mocked(useWordUpdate).mockReturnValue({updateLevelAsync: update} as never)
  vi.mocked(useSmartReview).mockReturnValue({completeItemAsync: complete} as never)
})

describe('four-way gestures', () => {
  it.each([[100, 0, 4], [-100, 0, 5], [0, -100, 3], [0, 100, 'skip'], [79, 0, null], [90, 85, null], [0, 0, null]])(
    'maps (%s,%s) to %s and ignores short/ambiguous drags', (x, y, expected) => {
      expect(swipeAction(x as number, y as number)).toBe(expected)
    })
})

describe('swipe review', () => {
  it('hides answer translations when Translations on cards is off', () => {
    visibility.translations = false
    open()
    expect(screen.queryByText('стойкий · устойчивый')).toBeNull()
  })
  it('resumes past an acknowledged recovery item without another rating or completion', () => {
    const q = queue()
    const stored = loadSwipeSession(q, 'en')
    saveSwipeSession({...stored, pending: {id: 101, level: 4}, decisions: {101: 'skip'}}, 'en')
    q.items[0].is_completed = true
    q.items[0].word.knowledge_level = 3
    q.completed_count = 1
    const restored = loadSwipeSession(q, 'en')
    expect(restored.pending).toBeNull()
    expect(restored.cursor).toBe(1)
    expect(restored.decisions[101]).toBe(3)
    open(q)
    expect(screen.getByRole('heading', {name: 'adapt'})).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect((screen.getByRole('button', {name: 'Mark Strong'}) as HTMLButtonElement).disabled).toBe(false)
    expect(update).not.toHaveBeenCalled()
    expect(complete).not.toHaveBeenCalled()
  })
  it('shows translations immediately, provides four actions and has no Undo', () => {
    open()
    expect(screen.getByRole('heading', {name: 'resilient'})).toBeTruthy()
    expect(screen.getByText('стойкий · устойчивый')).toBeTruthy()
    for (const name of ['Mark Strong', 'Mark Parked', 'Mark Okay', 'Skip for now']) expect(screen.getByRole('button', {name})).toBeTruthy()
    expect(screen.queryByRole('button', {name: /undo/i})).toBeNull()
  })

  it('skips without any writes and offers the skipped word at the end', async () => {
    open()
    fireEvent.click(screen.getByRole('button', {name: 'Skip for now'}))
    expect(screen.getByRole('heading', {name: 'adapt'})).toBeTruthy()
    expect(update).not.toHaveBeenCalled()
    expect(complete).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', {name: 'Mark Strong'}))
    fireEvent.click(screen.getByRole('button', {name: 'Mark Strong'}))
    await screen.findByRole('heading', {name: 'Mix complete'})
    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith(2, 4)
    expect(complete).toHaveBeenCalledWith(102)
    fireEvent.click(screen.getByRole('button', {name: 'Review skipped (1)'}))
    expect(screen.getByRole('heading', {name: 'resilient'})).toBeTruthy()
    fireEvent.click(screen.getByRole('button', {name: 'Mark Okay'}))
    await screen.findByRole('heading', {name: 'Mix complete'})
    expect(screen.queryByRole('button', {name: /Review skipped/})).toBeNull()
  })

  it('Previous and Next never rate or complete a word, including at the end', () => {
    open()
    fireEvent.click(screen.getByRole('button', {name: /Next/}))
    expect(screen.getByRole('heading', {name: 'adapt'})).toBeTruthy()
    fireEvent.click(screen.getByRole('button', {name: /Previous/}))
    expect(screen.getByRole('heading', {name: 'resilient'})).toBeTruthy()
    fireEvent.click(screen.getByRole('button', {name: /Next/}))
    fireEvent.click(screen.getByRole('button', {name: /Next/}))
    expect(screen.getByRole('heading', {name: 'End of this pass'})).toBeTruthy()
    fireEvent.click(screen.getByRole('button', {name: 'Review remaining (2)'}))
    expect(screen.getByRole('heading', {name: 'resilient'})).toBeTruthy()
    expect(update).not.toHaveBeenCalled()
    expect(complete).not.toHaveBeenCalled()
  })

  it('keeps the same card on failed rating and retries the chosen action', async () => {
    update.mockRejectedValueOnce(new Error('offline'))
    open()
    fireEvent.click(screen.getByRole('button', {name: 'Mark Parked'}))
    expect((await screen.findByRole('alert')).textContent).toContain('Could not save your rating')
    expect(screen.getByRole('heading', {name: 'resilient'})).toBeTruthy()
    expect(complete).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', {name: 'Retry'}))
    await screen.findByRole('heading', {name: 'adapt'})
    expect(update).toHaveBeenLastCalledWith(1, 5)
  })

  it('retries only completion after a rating saved successfully', async () => {
    complete.mockRejectedValueOnce(new Error('network'))
    open()
    fireEvent.click(screen.getByRole('button', {name: 'Mark Strong'}))
    expect((await screen.findByRole('alert')).textContent).toContain('Your rating is saved')
    fireEvent.click(screen.getByRole('button', {name: 'Retry'}))
    await screen.findByRole('heading', {name: 'adapt'})
    expect(update).toHaveBeenCalledTimes(1)
    expect(complete).toHaveBeenCalledTimes(2)
  })

  it('restores the cursor and skipped pass after leaving and reopening', () => {
    const view = open()
    fireEvent.click(screen.getByRole('button', {name: 'Skip for now'}))
    view.unmount()
    open()
    expect(screen.getByRole('heading', {name: 'adapt'})).toBeTruthy()
    fireEvent.click(screen.getByRole('button', {name: 'Skip for now'}))
    expect(screen.getByRole('button', {name: 'Review skipped (2)'})).toBeTruthy()
  })

  it('recovers pending completion after reload without saving the rating again', async () => {
    const q = queue()
    const session = loadSwipeSession(q, 'en')
    saveSwipeSession({...session, pending: {id: 101, level: 4}}, 'en')
    open(q)
    expect(screen.getByRole('alert').textContent).toContain('Retry')
    fireEvent.click(screen.getByRole('button', {name: 'Retry'}))
    await screen.findByRole('heading', {name: 'adapt'})
    expect(update).not.toHaveBeenCalled()
    expect(complete).toHaveBeenCalledOnce()
  })

  it('does not complete an already completed item a second time', async () => {
    const q = queue()
    q.items[0].is_completed = true
    open(q)
    fireEvent.click(screen.getByRole('button', {name: /Previous/}))
    fireEvent.click(screen.getByRole('button', {name: 'Mark Parked'}))
    await waitFor(() => expect(update).toHaveBeenCalledWith(1, 5))
    expect(complete).not.toHaveBeenCalled()
  })

  it('keeps language sessions separate and resets for a new generated queue', () => {
    const session = loadSwipeSession(queue(), 'en')
    saveSwipeSession({...session, cursor: 1}, 'en')
    expect(loadSwipeSession(queue('es'), 'es').cursor).toBe(0)
    expect(loadSwipeSession({...queue(), id: 8}, 'en').cursor).toBe(0)
    expect(loadSwipeSession({...queue(), generated_at: '2026-11-07T10:00:00Z'}, 'en').cursor).toBe(0)
  })

  it('ignores corrupt storage and keeps working when persistence is blocked', () => {
    localStorage.setItem(swipeStorageKey('en'), '{broken')
    expect(loadSwipeSession(queue(), 'en').cursor).toBe(0)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full') })
    open()
    fireEvent.click(screen.getByRole('button', {name: 'Skip for now'}))
    expect(screen.getByRole('heading', {name: 'adapt'})).toBeTruthy()
  })

  it('replaces corrupt metadata so the repaired session can resume', () => {
    localStorage.setItem(swipeStorageKey('en'), '{broken')
    saveSwipeSession({...loadSwipeSession(queue(), 'en'), cursor: 1}, 'en')
    expect(loadSwipeSession(queue(), 'en').cursor).toBe(1)
  })

  it('does not overwrite a new mix with a late save from an older mix', () => {
    const old = loadSwipeSession(queue(), 'en')
    const newerQueue = {...queue(), generated_at: '2026-11-07T10:00:00Z'}
    saveSwipeSession({...loadSwipeSession(newerQueue, 'en'), cursor: 1}, 'en')
    saveSwipeSession(old, 'en')
    expect(loadSwipeSession(newerQueue, 'en').cursor).toBe(1)
  })
})
