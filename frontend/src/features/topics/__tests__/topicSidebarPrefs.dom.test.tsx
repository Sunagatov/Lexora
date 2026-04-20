import {render, screen} from '@testing-library/react'
import {describe, it, expect} from 'vitest'
import {useTopicSidebarPrefs} from '../useTopicSidebarPrefs'

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
    </div>
  )
}

describe('useTopicSidebarPrefs DOM regression', () => {
  it('does not crash on corrupted localStorage values and falls back safely', () => {
    localStorage.setItem('sidebar_pinned', '{}')
    localStorage.setItem('sidebar_recent_topics', '"oops"')
    localStorage.setItem('sidebar_pos_sort', '"broken"')
    localStorage.setItem('sidebar_topics_sort', '123')
    localStorage.setItem('sidebar_pos_collapsed', '"yes"')
    localStorage.setItem('sidebar_topics_collapsed', 'null')

    render(<Probe />)

    expect(screen.getByTestId('pos-collapsed').textContent).toBe('false')
    expect(screen.getByTestId('topics-collapsed').textContent).toBe('false')
    expect(screen.getByTestId('pos-sort').textContent).toBe('weakest')
    expect(screen.getByTestId('topics-sort').textContent).toBe('weakest')
    expect(screen.getByTestId('pinned').textContent).toBe('')
    expect(screen.getByTestId('recent').textContent).toBe('')
  })
})
