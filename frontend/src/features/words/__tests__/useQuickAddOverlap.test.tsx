import {useRef} from 'react'
import {act, fireEvent, render, screen} from '@testing-library/react'
import {afterEach, beforeEach, expect, it, vi} from 'vitest'
import {useQuickAddOverlap} from '../hooks/useQuickAddOverlap'

let controlTop = 750
let mobile = true

function Harness({enabled = true}: {enabled?: boolean}) {
  const ref = useRef<HTMLButtonElement>(null)
  const hidden = useQuickAddOverlap(ref, enabled)
  return <>
    <div className="app-body"><article className="word-card"><button>Favorite</button></article></div>
    <button ref={ref} className="fab" data-obstructed={hidden}>Add word</button>
  </>
}

beforeEach(() => {
  vi.useFakeTimers()
  controlTop = 750
  mobile = true
  vi.spyOn(window, 'matchMedia').mockImplementation(() => ({
    get matches() { return mobile }, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }) as unknown as MediaQueryList)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('fab') ? new DOMRect(328, 718, 50, 50) : new DOMRect(317, controlTop, 44, 44)
  })
})

afterEach(() => { vi.useRealTimers() })

async function frame() { await act(async () => { await vi.advanceTimersByTimeAsync(20) }) }

it('hides Add over a card control and restores it when scrolling clears the overlap', async () => {
  render(<Harness />)
  await frame()
  expect(screen.getByText('Add word').dataset.obstructed).toBe('true')
  controlTop = 600
  fireEvent.scroll(screen.getByText('Favorite'))
  await frame()
  expect(screen.getByText('Add word').dataset.obstructed).toBe('false')
  controlTop = 750
  fireEvent.scroll(screen.getByText('Favorite'))
  await frame()
  expect(screen.getByText('Add word').dataset.obstructed).toBe('true')
})

it('rechecks after cards arrive or their text changes', async () => {
  controlTop = 600
  render(<Harness />)
  await frame()
  controlTop = 750
  await act(async () => { screen.getByText('Favorite').textContent = 'Remove favorite' })
  await frame()
  expect(screen.getByText('Add word').dataset.obstructed).toBe('true')
})

it('protects the invisible touch padding around the compact rating pill', async () => {
  controlTop = 775
  render(<Harness />)
  const control = screen.getByText('Favorite')
  control.classList.add('level-badge-btn')
  vi.spyOn(control, 'getBoundingClientRect').mockReturnValue(new DOMRect(317, 775, 44, 28))
  await frame()
  expect(screen.getByText('Add word').dataset.obstructed).toBe('true')
})

it('keeps desktop Add visible and rechecks a mobile resize', async () => {
  mobile = false
  render(<Harness />)
  await frame()
  expect(screen.getByText('Add word').dataset.obstructed).toBe('false')
  mobile = true
  fireEvent.resize(window)
  await frame()
  expect(screen.getByText('Add word').dataset.obstructed).toBe('true')
})

it('stops hiding when the route or an open sheet disables overlap checking', async () => {
  const view = render(<Harness />)
  await frame()
  view.rerender(<Harness enabled={false} />)
  expect(screen.getByText('Add word').dataset.obstructed).toBe('false')
})
