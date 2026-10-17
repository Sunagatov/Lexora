import {act, fireEvent, render, screen} from '@testing-library/react'
import {swipeDirection, useWordSwipe} from '../hooks/useWordSwipe'

function touch(element: HTMLElement, type: string, x: number, y: number) {
  const event = new Event(type, {bubbles: true})
  Object.assign(event, {pointerType: 'touch', pointerId: 1, isPrimary: true, clientX: x, clientY: y})
  fireEvent(element, event)
}

it.each([[100, 195, 4], [195, 100, 5]])('commits a deliberate touch gesture and suppresses the following link click (%s → %s)', (start, end, level) => {
  const onSwipe = vi.fn(), click = vi.fn()
  window.matchMedia = vi.fn().mockReturnValue({matches: true})
  function Card() { const {offset, ...events} = useWordSwipe(onSwipe, false); return <article {...events} data-testid="card"><a onClick={click}>word {offset}</a></article> }
  render(<Card />)
  const card = screen.getByTestId('card')
  card.setPointerCapture = vi.fn()
  touch(card, 'pointerdown', start, 100)
  touch(card, 'pointermove', end, 105)
  expect(screen.getByText(`word ${end - start}`)).toBeTruthy()
  touch(card, 'pointerup', end, 105)
  expect(onSwipe).toHaveBeenCalledExactlyOnceWith(level)
  fireEvent.click(screen.getByText('word 0'))
  expect(click).not.toHaveBeenCalled()
})

it('cancels short swipes and ignores swipes started on a button', () => {
  const onSwipe = vi.fn()
  window.matchMedia = vi.fn().mockReturnValue({matches: true})
  function Card() { const {offset, ...events} = useWordSwipe(onSwipe, false); return <article {...events} data-testid="card"><button>Speak</button><span>{offset}</span></article> }
  render(<Card />)
  const card = screen.getByTestId('card')
  card.setPointerCapture = vi.fn()
  touch(card, 'pointerdown', 100, 100); touch(card, 'pointermove', 140, 105); touch(card, 'pointerup', 140, 105)
  touch(screen.getByRole('button'), 'pointerdown', 100, 100); touch(card, 'pointerup', 200, 105)
  expect(onSwipe).not.toHaveBeenCalled()
})

it('requires a deliberate horizontal swipe in either direction', () => {
  expect(swipeDirection(72, 10)).toBe(4)
  expect(swipeDirection(-100, 20)).toBe(5)
  expect(swipeDirection(50, 5)).toBeNull()
  expect(swipeDirection(100, 90)).toBeNull()
})

it('keeps taps, vertical movement and interactive controls available', () => {
  const swipe = vi.fn(), click = vi.fn()
  window.matchMedia = vi.fn().mockReturnValue({matches: true})
  function Card() { const {offset, ...events} = useWordSwipe(swipe, false); return <article {...events} data-testid="card"><a onClick={click}>word {offset}</a><button>Speak</button></article> }
  render(<Card />)
  fireEvent.click(screen.getByText('word 0'))
  expect(click).toHaveBeenCalledOnce()
  act(() => {
    const card = screen.getByTestId('card')
    const point = (type: string, x: number, y: number) => {
      const event = new Event(type, {bubbles: true})
      Object.assign(event, {pointerType: 'touch', pointerId: 1, isPrimary: true, clientX: x, clientY: y})
      fireEvent(card, event)
    }
    point('pointerdown', 100, 100); point('pointermove', 110, 180); point('pointerup', 180, 200)
  })
  expect(swipe).not.toHaveBeenCalled()
})
