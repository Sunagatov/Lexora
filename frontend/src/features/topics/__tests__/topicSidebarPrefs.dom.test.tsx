import {render, screen} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {SIDEBAR_PREF_KEYS, useTopicSidebarPrefs} from '@/features/topics/hooks/useTopicSidebarPrefs'

function makeStorage() {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.get(key) ?? null
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
    removeItem(key: string) {
      store.delete(key)
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
  } as Storage
}

function Probe() {
  const prefs = useTopicSidebarPrefs()

  return (
    <div>
      <div data-testid="pos-collapsed">{String(prefs.posCollapsed)}</div>
      <div data-testid="topics-collapsed">{String(prefs.topicsCollapsed)}</div>
      <div data-testid="pos-sort">{prefs.posSort}</div>
      <div data-testid="topics-sort">{prefs.topicsSort}</div>
      <div data-testid="pinned">{prefs.pinnedIds.join(',')}</div>
      <div data-testid="recent">{prefs.recentIds.join(',')}</div>
      <div data-testid="expanded">{prefs.expandedTopicIds.join(',')}</div>
    </div>
  )
}

describe('useTopicSidebarPrefs DOM regression', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeStorage())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not crash on corrupted localStorage values and falls back safely', () => {
    localStorage.setItem(SIDEBAR_PREF_KEYS.pinned, '{}')
    localStorage.setItem(SIDEBAR_PREF_KEYS.recent, '"oops"')
    localStorage.setItem(SIDEBAR_PREF_KEYS.posSort, '"broken"')
    localStorage.setItem(SIDEBAR_PREF_KEYS.topicsSort, '123')
    localStorage.setItem(SIDEBAR_PREF_KEYS.posCollapsed, '"yes"')
    localStorage.setItem(SIDEBAR_PREF_KEYS.topicsCollapsed, 'null')
    localStorage.setItem(SIDEBAR_PREF_KEYS.expandedTopics, '{"bad":true}')

    render(<Probe />)

    expect(screen.getByTestId('pos-collapsed').textContent).toBe('false')
    expect(screen.getByTestId('topics-collapsed').textContent).toBe('false')
    expect(screen.getByTestId('pos-sort').textContent).toBe('weakest')
    expect(screen.getByTestId('topics-sort').textContent).toBe('weakest')
    expect(screen.getByTestId('pinned').textContent).toBe('')
    expect(screen.getByTestId('recent').textContent).toBe('')
    expect(screen.getByTestId('expanded').textContent).toBe('')
  })
})
