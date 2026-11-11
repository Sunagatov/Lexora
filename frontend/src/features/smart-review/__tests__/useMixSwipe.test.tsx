import {fireEvent, render, screen} from '@testing-library/react'
import {useMixSwipe} from '../hooks/useMixSwipe'

function pointer(element: HTMLElement, type: string, x: number, id = 1) {
  const event = new Event(type, {bubbles: true})
  Object.assign(event, {pointerType: 'touch', pointerId: id, isPrimary: id === 1, clientX: x, clientY: 100})
  fireEvent(element, event)
}
function Card({onAction, disabled = false}: {onAction: Parameters<typeof useMixSwipe>[0]; disabled?: boolean}) {
  const {events} = useMixSwipe(onAction, disabled)
  return <article {...events} data-testid="card"><h2>word</h2></article>
}
it.each([[250, 100, 5], [100, 250, 4]])('keeps the gesture when implicit capture transfers from a child (%s to %s)', (start, end, level) => {
  const onAction = vi.fn()
  render(<Card onAction={onAction} />)
  const card = screen.getByTestId('card'), child = screen.getByText('word')
  card.setPointerCapture = vi.fn()
  pointer(child, 'pointerdown', start)
  pointer(child, 'lostpointercapture', start)
  pointer(card, 'pointermove', end)
  pointer(card, 'pointerup', end)
  pointer(card, 'pointerup', end)
  expect(onAction).toHaveBeenCalledExactlyOnceWith(level)
})
it.each(['pointercancel', 'lostpointercapture'])('ignores unrelated pointer %s but cancels the active card gesture', type => {
  const onAction = vi.fn()
  render(<Card onAction={onAction} />)
  const card = screen.getByTestId('card')
  card.setPointerCapture = vi.fn()
  pointer(card, 'pointerdown', 250)
  pointer(card, type, 250, 2)
  pointer(card, 'pointerup', 100)
  expect(onAction).toHaveBeenCalledExactlyOnceWith(5)
  onAction.mockClear()
  pointer(card, 'pointerdown', 250)
  pointer(card, type, 100)
  pointer(card, 'pointerup', 100)
  expect(onAction).not.toHaveBeenCalled()
})

it('does not resume a gesture when a saving lock is enabled and then released', () => {
  const onAction = vi.fn()
  const {rerender} = render(<Card onAction={onAction} />)
  const card = screen.getByTestId('card')
  card.setPointerCapture = vi.fn()
  pointer(card, 'pointerdown', 250)
  pointer(card, 'pointermove', 100)
  rerender(<Card onAction={onAction} disabled />)
  rerender(<Card onAction={onAction} />)
  pointer(card, 'pointerup', 100)
  expect(onAction).not.toHaveBeenCalled()
  pointer(card, 'pointerdown', 250)
  pointer(card, 'pointerup', 100)
  expect(onAction).toHaveBeenCalledExactlyOnceWith(5)
})

it('cancels a rating when a second finger starts a pinch', () => {
  const onAction = vi.fn()
  render(<Card onAction={onAction} />)
  const card = screen.getByTestId('card')
  card.setPointerCapture = vi.fn()
  pointer(card, 'pointerdown', 250)
  pointer(card, 'pointermove', 100)
  pointer(card, 'pointerdown', 200, 2)
  pointer(card, 'pointerup', 100)
  expect(onAction).not.toHaveBeenCalled()
})

it.each([false, true])('keeps vertical reading gestures separate from ratings (heading=%s)', heading => {
  const onAction = vi.fn()
  function ReadingCard() {
    const {events} = useMixSwipe(onAction, false)
    return <article {...events} data-testid="card"><div data-mix-scrollable="true">
      <h2 data-mix-gesture-surface>word</h2><p>Long example</p>
    </div></article>
  }
  render(<ReadingCard />)
  const card = screen.getByTestId('card'), target = screen.getByText(heading ? 'word' : 'Long example')
  card.setPointerCapture = vi.fn()
  pointer(target, 'pointerdown', 150)
  const up = new Event('pointerup', {bubbles: true})
  Object.assign(up, {pointerType:'touch',pointerId:1,isPrimary:true,clientX:150,clientY:0})
  fireEvent(card, up)
  if (heading) expect(onAction).toHaveBeenCalledExactlyOnceWith(3)
  else expect(onAction).not.toHaveBeenCalled()
})
