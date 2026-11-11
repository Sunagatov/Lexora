import {createPortal} from 'react-dom'
import {fireEvent, render, screen} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'
import {StudySidebarShell} from '@/features/study/components/StudySidebarShell'

vi.mock('@/shared/hooks/useIsMobile', () => ({useIsMobile: () => true}))
vi.mock('@/features/topics/components/TopicSidebar', () => ({
  TopicSidebar: () => <>
    <button>Topic row</button><input aria-label="Topic search" />
    {createPortal(<div role="dialog"><button>Popup action</button></div>, document.body)}
  </>,
}))

function setup() {
  const setDrawerOpen = vi.fn()
  render(<StudySidebarShell overlayOnly drawerOpen setDrawerOpen={setDrawerOpen}
    sidebarWidth={300} sidebarCollapsed={false} isResizing={false} handleSidebarResizeDown={vi.fn()}
    sidebarProps={{topics: [], topicCounts: new Map(), topicProgress: new Map(), topicSearch: '',
      setTopicSearch: vi.fn(), selectedTopicId: null, isSmartReview: false, smartQueue: null,
      onSelect: vi.fn(), onSelectSmartReview: vi.fn()}} />)
  const row = screen.getByRole('button', {name: 'Topic row'})
  const drawer = document.querySelector('.mobile-drawer') as HTMLElement
  return {row, drawer, setDrawerOpen}
}
const point = (clientX: number, clientY: number, identifier = 1) => ({clientX, clientY, identifier})
const start = (target: Element, ...touches: ReturnType<typeof point>[]) => fireEvent.touchStart(target, {touches})
const move = (target: Element, ...touches: ReturnType<typeof point>[]) => fireEvent.touchMove(target, {touches})
const end = (target: Element) => fireEvent.touchEnd(target, {touches: []})

describe('drawer touch intent', () => {
  it('tracks an intentional left drag immediately and closes once', () => {
    const {row, drawer, setDrawerOpen} = setup()
    start(row, point(260, 400))
    move(row, point(140, 403))
    expect(drawer.style.transform).toBe('translateX(-120px)')
    expect(drawer.hasAttribute('data-swiping')).toBe(true)
    end(row)
    expect(drawer.style.transform).toBe('')
    expect(setDrawerOpen).toHaveBeenCalledExactlyOnceWith(false)
  })

  it('keeps a vertical scroll locked even if the finger later moves left', () => {
    const {row, drawer, setDrawerOpen} = setup()
    start(row, point(260, 560))
    move(row, point(260, 520))
    move(row, point(120, 450))
    end(row)
    expect(drawer.style.transform).toBe('')
    expect(setDrawerOpen).not.toHaveBeenCalled()
  })

  it('ignores jitter, diagonal gestures, taps and short or reversed drags', () => {
    const {row, drawer, setDrawerOpen} = setup()
    start(row, point(260, 400)); move(row, point(255, 402))
    expect(drawer.style.transform).toBe('')
    move(row, point(200, 460)); move(row, point(100, 460)); end(row)
    start(row, point(260, 400)); end(row)
    start(row, point(260, 400)); move(row, point(230, 401)); end(row)
    start(row, point(260, 400)); move(row, point(150, 401)); move(row, point(270, 402)); end(row)
    expect(setDrawerOpen).not.toHaveBeenCalled()
  })

  it('cancels when another finger joins, without resuming after it lifts', () => {
    const {row, drawer, setDrawerOpen} = setup()
    start(row, point(260, 400)); move(row, point(150, 401))
    start(row, point(150, 401), point(280, 401, 2))
    move(row, point(50, 401)); end(row)
    expect(drawer.style.transform).toBe('')
    expect(setDrawerOpen).not.toHaveBeenCalled()
    start(row, point(260, 400), point(280, 401, 2))
    move(row, point(50, 401)); end(row)
    expect(setDrawerOpen).not.toHaveBeenCalled()
  })

  it('excludes portalled popup gestures and text fields', () => {
    const {setDrawerOpen} = setup()
    for (const target of [screen.getByRole('button', {name: 'Popup action'}), screen.getByLabelText('Topic search')]) {
      start(target, point(260, 400)); move(target, point(100, 400)); end(target)
    }
    expect(setDrawerOpen).not.toHaveBeenCalled()
  })

  it('discards a cancelled drag and requires a fresh gesture', () => {
    const {row, setDrawerOpen} = setup()
    start(row, point(260, 400)); move(row, point(150, 401))
    fireEvent.touchCancel(row, {touches: []})
    move(row, point(50, 401)); end(row)
    expect(setDrawerOpen).not.toHaveBeenCalled()
    start(row, point(260, 400)); move(row, point(150, 401)); end(row)
    expect(setDrawerOpen).toHaveBeenCalledExactlyOnceWith(false)
  })
})
