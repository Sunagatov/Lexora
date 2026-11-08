import {useState} from 'react'
import {fireEvent, render, screen} from '@testing-library/react'
import {beforeEach, expect, it, vi} from 'vitest'
import {StudySidebarShell} from './StudySidebarShell'
import {useIsMobile} from '@/shared/hooks/useIsMobile'

vi.mock('@/shared/hooks/useIsMobile', () => ({useIsMobile: vi.fn()}))
vi.mock('@/features/topics/components/TopicSidebar', () => ({
  TopicSidebar: ({isMobile}: {isMobile?: boolean}) => <button>{isMobile ? 'Mobile navigation' : 'Desktop navigation'}</button>,
}))

function Harness() {
  const [open, setOpen] = useState(false)
  return <>
    <button onClick={() => setOpen(true)}>Open sidebar</button>
    <StudySidebarShell drawerOpen={open} setDrawerOpen={setOpen} sidebarWidth={320}
      sidebarCollapsed={false} isResizing={false} handleSidebarResizeDown={vi.fn()}
      sidebarProps={{topics: [], topicCounts: new Map(), topicProgress: new Map(),
        topicSearch: '', setTopicSearch: vi.fn(), selectedTopicId: null, isSmartReview: false,
        onSelect: vi.fn(), onSelectSmartReview: vi.fn(), smartQueue: null}} />
  </>
}

beforeEach(() => { vi.mocked(useIsMobile).mockReturnValue(true) })

it('focuses mobile navigation on open and returns focus to its trigger after Escape', () => {
  render(<Harness />)
  const trigger = screen.getByRole('button', {name: 'Open sidebar'})
  trigger.focus()
  fireEvent.click(trigger)
  expect(document.activeElement).toBe(screen.getByRole('button', {name: 'Mobile navigation'}))
  fireEvent.keyDown(document.activeElement!, {key: 'Escape'})
  expect(document.activeElement).toBe(trigger)
  expect(document.querySelector('#mobile-topic-drawer')?.getAttribute('aria-hidden')).toBe('true')
})

it('closes the mobile drawer when resizing into the desktop layout', () => {
  const {rerender} = render(<Harness />)
  fireEvent.click(screen.getByRole('button', {name: 'Open sidebar'}))
  vi.mocked(useIsMobile).mockReturnValue(false)
  rerender(<Harness />)
  expect(document.querySelector('#mobile-topic-drawer')?.getAttribute('aria-hidden')).toBe('true')
})
