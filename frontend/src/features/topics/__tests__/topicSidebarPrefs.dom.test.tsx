import {render, screen} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {useTopicSidebarPrefs} from '../useTopicSidebarPrefs'

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
    localStorage.setItem('sidebar_pinned', '{}')
    localStorage.setItem('sidebar_recent_topics', '"oops"')
    localStorage.setItem('sidebar_pos_sort', '"broken"')
    localStorage.setItem('sidebar_topics_sort', '123')
    localStorage.setItem('sidebar_pos_collapsed', '"yes"')
    localStorage.setItem('sidebar_topics_collapsed', 'null')
    localStorage.setItem('sidebar_expanded_topics', '{"bad":true}')

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
