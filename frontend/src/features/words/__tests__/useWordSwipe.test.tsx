import {act, fireEvent, render, screen} from '@testing-library/react'
import {swipeDirection, useWordSwipe} from '../hooks/useWordSwipe'

function touch(element: HTMLElement, type: string, x: number, y: number) {
  const event = new Event(type, {bubbles: true})
  Object.assign(event, {pointerType: 'touch', pointerId: 1, isPrimary: true, clientX: x, clientY: y})
  fireEvent(element, event)
}

it.each([[100, 195, 4], [195, 100, 5]])('commits a deliberate touch gesture and suppresses the following link click (%s Р Р†РІР‚В РІР‚в„ў %s)', (start, end, level) => {
  const onSwipe = vi.fn(), click = vi.fn()
  window.matchMedia = vi.fn().mockReturnValue({matches: true})
  function Card() { const {offset, ready, ...events} = useWordSwipe(onSwipe, false); return <article {...events} data-testid="card" data-ready={ready}><a onClick={click}>word {offset}</a></article> }
  render(<Card />)
  const card = screen.getByTestId('card')
  card.setPointerCapture = vi.fn()
  touch(card, 'pointerdown', start, 100)
  touch(card, 'pointermove', end, 105)
  expect(screen.getByText(`word ${end - start}`)).toBeTruthy()
  touch(card, 'pointerup', end, 105)
  expect(onSwipe).toHaveBeenCalledExactlyOnceWith(level)
  fireEvent.click(screen.getByText('word 0'), {detail: 1})
  expect(click).not.toHaveBeenCalled()
})

it('cancels short swipes and ignores swipes started on a button', () => {
  const onSwipe = vi.fn()
  window.matchMedia = vi.fn().mockReturnValue({matches: true})
  function Card() { const {offset, ready, ...events} = useWordSwipe(onSwipe, false); return <article {...events} data-testid="card" data-ready={ready}><button>Speak</button><span>{offset}</span></article> }
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

it('keeps swiping when the inner word link loses its implicit touch capture', () => {
  const onSwipe = vi.fn()
  window.matchMedia = vi.fn().mockReturnValue({matches: true})
  function Card() { const {offset, ready, ...events} = useWordSwipe(onSwipe, false); return <article {...events} data-testid="card" data-ready={ready}><a href="/words/1">word {offset}</a></article> }
  render(<Card />)
  const card = screen.getByTestId('card'), link = screen.getByRole('link')
  card.setPointerCapture = vi.fn()
  touch(link, 'pointerdown', 100, 100)
  touch(link, 'pointermove', 125, 102)
  // Real touch browsers transfer capture from the touched child to the card.
  touch(link, 'lostpointercapture', 125, 102)
  touch(card, 'pointermove', 195, 105)
  touch(card, 'pointerup', 195, 105)
  expect(onSwipe).toHaveBeenCalledExactlyOnceWith(4)
})

it('also accepts a primary mouse drag on a visible card', () => {
  const onSwipe = vi.fn()
  function Card() { const {offset, ready, ...events} = useWordSwipe(onSwipe, false); return <article {...events} data-testid="card" data-ready={ready}>word {offset}</article> }
  render(<Card />)
  const card = screen.getByTestId('card')
  card.setPointerCapture = vi.fn()
  for (const [type, x] of [['pointerdown', 200], ['pointermove', 100], ['pointerup', 100]] as const) {
    const event = new Event(type, {bubbles: true})
    Object.assign(event, {pointerType: 'mouse', pointerId: 1, button: 0, buttons: type === 'pointerup' ? 0 : 1, isPrimary: true, clientX: x, clientY: 100})
    fireEvent(card, event)
  }
  expect(onSwipe).toHaveBeenCalledExactlyOnceWith(5)
})

it.each(['pointercancel', 'lostpointercapture'])('cancels when the card itself receives %s', type => {
  const onSwipe = vi.fn()
  function Card() { const {offset, ready, ...events} = useWordSwipe(onSwipe, false); return <article {...events} data-testid="card" data-ready={ready}>word {offset}</article> }
  render(<Card />)
  const card = screen.getByTestId('card')
  card.setPointerCapture = vi.fn()
  touch(card, 'pointerdown', 100, 100)
  touch(card, 'pointermove', 195, 105)
  touch(card, type, 195, 105)
  touch(card, 'pointerup', 195, 105)
  expect(onSwipe).not.toHaveBeenCalled()
  expect(screen.getByText('word 0')).toBeTruthy()
})

it('keeps taps, vertical movement and interactive controls available', () => {
  const swipe = vi.fn(), click = vi.fn()
  window.matchMedia = vi.fn().mockReturnValue({matches: true})
  function Card() { const {offset, ready, ...events} = useWordSwipe(swipe, false); return <article {...events} data-testid="card" data-ready={ready}><a onClick={click}>word {offset}</a><button>Speak</button></article> }
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

it('does not swallow the next button tap after a cancelled drag', () => {
  const onSwipe = vi.fn(), click = vi.fn()
  function Card() { const {offset, ready, ...events} = useWordSwipe(onSwipe, false); return <article {...events} data-testid="card" data-ready={ready}><span>word {offset}</span><button onClick={click}>Level</button></article> }
  render(<Card />)
  const card = screen.getByTestId('card'), button = screen.getByRole('button')
  card.setPointerCapture = vi.fn()
  touch(card, 'pointerdown', 100, 100)
  touch(card, 'pointermove', 195, 105)
  touch(card, 'pointercancel', 195, 105)
  touch(button, 'pointerdown', 195, 105)
  touch(button, 'pointerup', 195, 105)
  fireEvent.click(button)
  expect(onSwipe).not.toHaveBeenCalled()
  expect(click).toHaveBeenCalledOnce()
})


it('keeps keyboard activation available after a cancelled drag', () => {
  const onSwipe = vi.fn(), click = vi.fn()
  function Card() { const {offset, ready, ...events} = useWordSwipe(onSwipe, false); return <article {...events} data-testid="card" data-ready={ready}><a onClick={click}>word {offset}</a></article> }
  render(<Card />)
  const card = screen.getByTestId('card')
  card.setPointerCapture = vi.fn()
  touch(card, 'pointerdown', 100, 100)
  touch(card, 'pointermove', 195, 105)
  touch(card, 'pointercancel', 195, 105)
  fireEvent.click(screen.getByText('word 0'), {detail: 0})
  expect(click).toHaveBeenCalledOnce()
  expect(onSwipe).not.toHaveBeenCalled()
})

it('does not cancel the active swipe when a different pointer is cancelled', () => {
  const onSwipe = vi.fn()
  function Card() { const {offset, ready, ...events} = useWordSwipe(onSwipe, false); return <article {...events} data-testid="card" data-ready={ready}>word {offset}</article> }
  render(<Card />)
  const card = screen.getByTestId('card')
  card.setPointerCapture = vi.fn()
  touch(card, 'pointerdown', 100, 100)
  touch(card, 'pointermove', 195, 105)
  const event = new Event('pointercancel', {bubbles: true})
  Object.assign(event, {pointerType: 'touch', pointerId: 2, isPrimary: false})
  fireEvent(card, event)
  touch(card, 'pointerup', 195, 105)
  expect(onSwipe).toHaveBeenCalledExactlyOnceWith(4)
})

it('waits for a clear horizontal direction before capturing a diagonal drag', () => {
  const onSwipe = vi.fn()
  function Card() { const {offset, ready, ...events} = useWordSwipe(onSwipe, false); return <article {...events} data-testid="card" data-ready={ready}>word {offset}</article> }
  render(<Card />)
  const card = screen.getByTestId('card')
  card.setPointerCapture = vi.fn()
  touch(card, 'pointerdown', 100, 100)
  touch(card, 'pointermove', 120, 117)
  expect(card.setPointerCapture).not.toHaveBeenCalled()
  expect(screen.getByText('word 0')).toBeTruthy()
  touch(card, 'pointermove', 195, 105)
  touch(card, 'pointerup', 195, 105)
  expect(onSwipe).toHaveBeenCalledExactlyOnceWith(4)
})

it('stops moving a card when saving disables it during a drag', () => {
  const onSwipe = vi.fn()
  function Card({disabled}: {disabled: boolean}) { const {offset, ready, ...events} = useWordSwipe(onSwipe, disabled); return <article {...events} data-testid="card" data-ready={ready}>word {offset}</article> }
  const {rerender} = render(<Card disabled={false} />)
  const card = screen.getByTestId('card')
  card.setPointerCapture = vi.fn()
  touch(card, 'pointerdown', 100, 100)
  touch(card, 'pointermove', 195, 105)
  rerender(<Card disabled />)
  expect(screen.getByText('word 0')).toBeTruthy()
  touch(card, 'pointermove', 210, 105)
  touch(card, 'pointerup', 210, 105)
  expect(onSwipe).not.toHaveBeenCalled()
})


it('cancels a swipe dragged back below the threshold without opening the word', () => {
  const onSwipe = vi.fn(), click = vi.fn()
  function Card() { const {offset, ready, ...events} = useWordSwipe(onSwipe, false); return <article {...events} data-testid="card" data-ready={ready}><a onClick={click}>word {offset}</a></article> }
  render(<Card />)
  const card = screen.getByTestId('card')
  card.setPointerCapture = vi.fn()
  touch(card, 'pointerdown', 100, 100)
  touch(card, 'pointermove', 195, 105)
  expect(card.dataset.ready).toBe('true')
  touch(card, 'pointermove', 135, 105)
  expect(card.dataset.ready).toBe('false')
  touch(card, 'pointerup', 135, 105)
  fireEvent.click(screen.getByText('word 0'), {detail: 1})
  expect(onSwipe).not.toHaveBeenCalled()
  expect(click).not.toHaveBeenCalled()
})

it('leaves vertical scrolling and screen-edge navigation alone', () => {
  const onSwipe = vi.fn()
  function Card() { const {offset, ready, ...events} = useWordSwipe(onSwipe, false); return <article {...events} data-testid="card" data-ready={ready}>word {offset}</article> }
  render(<Card />)
  const card = screen.getByTestId('card')
  card.setPointerCapture = vi.fn()
  for (const [x, endX, endY] of [[100, 110, 200], [10, 110, 100], [window.innerWidth - 10, window.innerWidth - 110, 100]]) {
    touch(card, 'pointerdown', x, 100)
    touch(card, 'pointermove', endX, endY)
    touch(card, 'pointerup', endX, endY)
  }
  expect(card.setPointerCapture).not.toHaveBeenCalled()
  expect(onSwipe).not.toHaveBeenCalled()
  expect(screen.getByText('word 0')).toBeTruthy()
})


it.each([[135, 128], [105, 130]])('does not open the word after a non-swipe drag ending at %s,%s', (x, y) => {
  const onSwipe = vi.fn(), click = vi.fn()
  function Card() { const {offset, ready, ...events} = useWordSwipe(onSwipe, false); return <article {...events} data-testid="card" data-ready={ready}><a onClick={click}>word {offset}</a></article> }
  render(<Card />)
  const card = screen.getByTestId('card')
  card.setPointerCapture = vi.fn()
  touch(card, 'pointerdown', 100, 100)
  touch(card, 'pointermove', x, y)
  touch(card, 'pointerup', x, y)
  fireEvent.click(screen.getByText('word 0'), {detail: 1})
  expect(onSwipe).not.toHaveBeenCalled()
  expect(click).not.toHaveBeenCalled()
})


it('does not resume an old gesture after a saving lock is released', () => {
  const onSwipe = vi.fn()
  function Card({disabled}: {disabled: boolean}) { const {offset, ready, ...events} = useWordSwipe(onSwipe, disabled); return <article {...events} data-testid="card" data-ready={ready}>word {offset}</article> }
  const {rerender} = render(<Card disabled={false} />)
  const card = screen.getByTestId('card')
  card.setPointerCapture = vi.fn()
  touch(card, 'pointerdown', 100, 100)
  touch(card, 'pointermove', 195, 105)
  rerender(<Card disabled />)
  rerender(<Card disabled={false} />)
  expect(screen.getByText('word 0')).toBeTruthy()
  touch(card, 'pointerup', 195, 105)
  expect(onSwipe).not.toHaveBeenCalled()
  touch(card, 'pointerdown', 195, 100)
  touch(card, 'pointermove', 100, 105)
  touch(card, 'pointerup', 100, 105)
  expect(onSwipe).toHaveBeenCalledExactlyOnceWith(5)
})

it.each([0, 2])('stops a mouse drag when its primary button is no longer pressed (buttons=%s)', buttons => {
  const onSwipe = vi.fn()
  function Card() { const {offset, ready, ...events} = useWordSwipe(onSwipe, false); return <article {...events} data-testid="card" data-ready={ready}>word {offset}</article> }
  render(<Card />)
  const card = screen.getByTestId('card')
  card.setPointerCapture = vi.fn()
  for (const [type, x, heldButtons] of [['pointerdown', 100, 1], ['pointermove', 130, 1], ['pointermove', 195, buttons], ['pointerup', 195, 0]] as const) {
    const event = new Event(type, {bubbles: true})
    Object.assign(event, {pointerType: 'mouse', pointerId: 1, button: 0, buttons: heldButtons, isPrimary: true, clientX: x, clientY: 100})
    fireEvent(card, event)
  }
  expect(onSwipe).not.toHaveBeenCalled()
  expect(screen.getByText('word 0')).toBeTruthy()
})


it('ignores a swipe started while saving without accidentally opening the word', () => {
  const onSwipe = vi.fn(), click = vi.fn()
  function Card({disabled}: {disabled: boolean}) { const {offset, ready, ...events} = useWordSwipe(onSwipe, disabled); return <article {...events} data-testid="card" data-ready={ready}><a onClick={click}>word {offset}</a></article> }
  const {rerender} = render(<Card disabled />)
  const card = screen.getByTestId('card')
  card.setPointerCapture = vi.fn()
  touch(card, 'pointerdown', 195, 100)
  touch(card, 'pointermove', 100, 105)
  rerender(<Card disabled={false} />)
  touch(card, 'pointerup', 100, 105)
  fireEvent.click(screen.getByText('word 0'), {detail: 1})
  expect(onSwipe).not.toHaveBeenCalled()
  expect(click).not.toHaveBeenCalled()
  expect(screen.getByText('word 0')).toBeTruthy()
  touch(card, 'pointerdown', 100, 100)
  touch(card, 'pointerup', 100, 100)
  fireEvent.click(screen.getByText('word 0'), {detail: 1})
  expect(click).toHaveBeenCalledOnce()
})


it.each([[100, 195, 4], [195, 100, 5]])('handles a fast flick with no intermediate move event (%s to %s)', (x, endX, level) => {
  const onSwipe = vi.fn(), click = vi.fn()
  function Card() { const {offset, ready, ...events} = useWordSwipe(onSwipe, false); return <article {...events} data-testid="card" data-ready={ready}><a onClick={click}>word {offset}</a></article> }
  render(<Card />)
  const card = screen.getByTestId('card')
  touch(card, 'pointerdown', x, 100)
  touch(card, 'pointerup', endX, 105)
  fireEvent.click(screen.getByText('word 0'), {detail: 1})
  expect(onSwipe).toHaveBeenCalledExactlyOnceWith(level)
  expect(click).not.toHaveBeenCalled()
})

it.each([false, true])('does not open word details after a short fast drag (disabled=%s)', disabled => {
  const onSwipe = vi.fn(), click = vi.fn()
  function Card() { const {offset, ready, ...events} = useWordSwipe(onSwipe, disabled); return <article {...events} data-testid="card" data-ready={ready}><a onClick={click}>word {offset}</a></article> }
  render(<Card />)
  const card = screen.getByTestId('card')
  touch(card, 'pointerdown', 100, 100)
  touch(card, 'pointerup', 140, 105)
  fireEvent.click(screen.getByText('word 0'), {detail: 1})
  expect(onSwipe).not.toHaveBeenCalled()
  expect(click).not.toHaveBeenCalled()
})

it('uses the final direction after dragging across the starting point and commits once', () => {
  const onSwipe = vi.fn()
  function Card() { const {offset, ready, ...events} = useWordSwipe(onSwipe, false); return <article {...events} data-testid="card" data-ready={ready}>word {offset}</article> }
  render(<Card />)
  const card = screen.getByTestId('card')
  card.setPointerCapture = vi.fn()
  touch(card, 'pointerdown', 200, 100)
  touch(card, 'pointermove', 295, 105)
  touch(card, 'pointermove', 100, 105)
  touch(card, 'pointerup', 100, 105)
  touch(card, 'pointerup', 100, 105)
  expect(onSwipe).toHaveBeenCalledExactlyOnceWith(5)
  expect(screen.getByText('word 0')).toBeTruthy()
})
